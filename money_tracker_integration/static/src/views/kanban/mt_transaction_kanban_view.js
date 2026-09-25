/** @odoo-module **/

import { registry } from "@web/core/registry";
import { Domain } from "@web/core/domain";
import {
    deserializeDate,
    deserializeDateTime,
    serializeDate,
    serializeDateTime,
} from "@web/core/l10n/dates";
import { RelationalModel } from "@web/model/relational_model/relational_model";
import {
    extractInfoFromGroupData,
    getGroupServerValue,
    isRelational,
    makeActiveField,
} from "@web/model/relational_model/utils";
import { kanbanView } from "@web/views/kanban/kanban_view";
import { KanbanController } from "@web/views/kanban/kanban_controller";
import { KanbanRenderer } from "@web/views/kanban/kanban_renderer";
import { MTTransactionDashboard } from "./mt_transaction_dashboard";
import { useSubEnv } from "@odoo/owl";

export class MTTransactionKanbanModel extends RelationalModel {
    static DEFAULT_OPEN_GROUP_LIMIT = 31;
    static MAX_NUMBER_OPENED_GROUPS = 31;

    async _loadGroupedList(config) {
        if (
            config.resModel !== "money_tracker.transaction" ||
            config.groupBy.length !== 1 ||
            !this._canBatchLoadTransactionGroups(config)
        ) {
            return super._loadGroupedList(config);
        }

        return this._loadTransactionGroups(config);
    }

    _canBatchLoadTransactionGroups(config) {
        const groupByFieldName = this._getGroupByFieldName(config);
        const field = config.fields[groupByFieldName];
        return (
            field &&
            !groupByFieldName.includes(".") &&
            !["one2many", "properties"].includes(field.type)
        );
    }

    _getGroupByFieldName(config) {
        return config.groupBy[0].split(":")[0];
    }

    async _loadTransactionGroups(config) {
        config.offset = config.offset || 0;
        config.limit = config.limit || this.initialGroupsLimit;
        if (!config.limit) {
            config.limit = config.openGroupsByDefault
                ? this.constructor.DEFAULT_OPEN_GROUP_LIMIT
                : this.constructor.DEFAULT_GROUP_LIMIT;
        }
        config.groups = config.groups || {};

        const firstGroupByName = this._getGroupByFieldName(config);
        if (!config.activeFields[firstGroupByName]) {
            config.activeFields[firstGroupByName] = makeActiveField();
        }
        const groupByField = config.fields[firstGroupByName];
        const orderBy = config.orderBy.filter(
            (o) =>
                o.name === firstGroupByName ||
                o.name === "__count" ||
                (o.name in config.activeFields && config.fields[o.name].aggregator !== undefined)
        );
        const response = await this._webReadGroup(config, orderBy);
        const { groups: groupsData, length } = response;
        const commonConfig = {
            resModel: config.resModel,
            fields: config.fields,
            activeFields: config.activeFields,
        };
        const groups = [];
        const openGroups = [];
        let nbOpenGroups = 0;
        let groupRecordConfig;
        const groupRecordResIds = [];
        if (this.groupByInfo[firstGroupByName]) {
            groupRecordConfig = {
                ...this.groupByInfo[firstGroupByName],
                resModel: config.fields[firstGroupByName].relation,
                context: {},
            };
        }

        for (const groupData of groupsData) {
            const group = extractInfoFromGroupData(groupData, config.groupBy, config.fields);
            if (!config.groups[group.value]) {
                config.groups[group.value] = {
                    ...commonConfig,
                    groupByFieldName: groupByField.name,
                    isFolded:
                        "__fold" in groupData ? groupData.__fold : !config.openGroupsByDefault,
                    extraDomain: false,
                    value: group.value,
                    list: {
                        ...commonConfig,
                        groupBy: [],
                    },
                };
                if (isRelational(config.fields[firstGroupByName]) && !group.value) {
                    config.groups[group.value].isFolded = true;
                }
            }
            if (groupRecordConfig && !config.groups[group.value].record) {
                config.groups[group.value].record = {
                    ...groupRecordConfig,
                    resId: group.value ?? false,
                };
            }
            if (groupRecordConfig) {
                const resId = config.groups[group.value].record.resId;
                if (resId) {
                    groupRecordResIds.push(resId);
                }
            }

            const groupConfig = config.groups[group.value];
            groupConfig.list.orderBy = config.orderBy;
            groupConfig.initialDomain = group.domain;
            groupConfig.list.domain = groupConfig.extraDomain
                ? Domain.and([group.domain, groupConfig.extraDomain]).toList()
                : group.domain;
            const context = {
                ...config.context,
                [`default_${firstGroupByName}`]: group.serverValue,
            };
            groupConfig.list.context = context;
            groupConfig.context = context;
            group.records = [];

            if (!groupConfig.isFolded) {
                nbOpenGroups++;
                if (nbOpenGroups > this.constructor.MAX_NUMBER_OPENED_GROUPS) {
                    groupConfig.isFolded = true;
                }
            }
            if (!groupConfig.isFolded && group.count > 0) {
                openGroups.push({ group, groupConfig });
            }
            groups.push(group);
        }

        await this._batchLoadTransactionGroupRecords(config, openGroups, commonConfig);
        if (groupRecordConfig && Object.keys(groupRecordConfig.activeFields).length) {
            const records = await this._loadRecords({
                ...groupRecordConfig,
                resIds: groupRecordResIds,
            });
            for (const group of groups) {
                if (!group.value) {
                    group.values = { id: false };
                    continue;
                }
                group.values = records.find((r) => group.value && r.id === group.value);
            }
        }
        this._preserveCurrentTransactionGroups(config, groups);

        return { groups, length };
    }

    async _batchLoadTransactionGroupRecords(config, openGroups, commonConfig) {
        if (!openGroups.length) {
            return;
        }

        const batchLimit = openGroups.reduce((total, { group }) => total + group.count, 0);
        const batchDomain = Domain.or(
            openGroups.map(({ groupConfig }) => groupConfig.list.domain)
        ).toList();
        const response = await this._loadData({
            ...commonConfig,
            context: config.context,
            currentCompanyId: config.currentCompanyId,
            domain: batchDomain,
            groupBy: [],
            orderBy: config.orderBy,
            offset: 0,
            limit: batchLimit,
            countLimit: batchLimit,
        });
        const recordsByGroup = new Map();

        for (const record of response.records) {
            for (const groupKey of this._getRecordGroupKeys(record, config)) {
                if (!recordsByGroup.has(groupKey)) {
                    recordsByGroup.set(groupKey, []);
                }
                recordsByGroup.get(groupKey).push(record);
            }
        }

        for (const { group } of openGroups) {
            group.records = recordsByGroup.get(this._getGroupKey(group.serverValue)) || [];
        }
    }

    _getRecordGroupKeys(record, config) {
        const fieldName = this._getGroupByFieldName(config);
        const field = config.fields[fieldName];
        const value = record[fieldName];
        const interval = this._getGroupByInterval(config);

        if (["date", "datetime"].includes(field.type)) {
            return [this._getGroupKey(this._getDateGroupServerValue(field, value, interval))];
        }

        if (field.type === "many2many" || field.type === "tags") {
            const values = Array.isArray(value) ? value : [];
            return values.length
                ? values.map((item) => this._getGroupKey(this._getRelationalValueId(item)))
                : [this._getGroupKey(false)];
        }

        if (isRelational(field)) {
            return [this._getGroupKey(this._getRelationalValueId(value))];
        }

        return [this._getGroupKey(getGroupServerValue(field, value))];
    }

    _getGroupByInterval(config) {
        return config.groupBy[0].split(":")[1];
    }

    _getDateGroupServerValue(field, value, interval) {
        if (!value) {
            return false;
        }

        const deserialize = field.type === "date" ? deserializeDate : deserializeDateTime;
        const serialize = field.type === "date" ? serializeDate : serializeDateTime;
        const dateValue = deserialize(value);
        if (!interval || interval === "day") {
            return serialize(dateValue);
        }
        if (["week", "month", "quarter", "year"].includes(interval)) {
            return serialize(dateValue.endOf(interval));
        }
        return serialize(dateValue);
    }

    _getRelationalValueId(value) {
        if (Array.isArray(value)) {
            return value[0] || false;
        }
        if (value && typeof value === "object") {
            return value.id || false;
        }
        return value || false;
    }

    _getGroupKey(value) {
        return JSON.stringify(value || false);
    }

    _preserveCurrentTransactionGroups(config, groups) {
        const params = JSON.stringify([
            config.domain,
            config.groupBy,
            config.offset,
            config.limit,
            config.orderBy,
        ]);
        if (config.currentGroups && config.currentGroups.params === params) {
            const currentGroups = config.currentGroups.groups;
            currentGroups.forEach((group, index) => {
                if (
                    config.groups[group.value] &&
                    !groups.some((g) => JSON.stringify(g.value) === JSON.stringify(group.value))
                ) {
                    const aggregates = Object.assign({}, group.aggregates);
                    for (const key in aggregates) {
                        aggregates[key] = 0;
                    }
                    groups.splice(
                        index,
                        0,
                        Object.assign({}, group, { count: 0, length: 0, records: [], aggregates })
                    );
                }
            });
        }
        config.currentGroups = { params, groups };
    }
}

export class MTTransactionDashboardKanbanController extends KanbanController {
    setup() {
        super.setup(...arguments);
        useSubEnv({ model: this.model });
    }

    get className() {
        const className = super.className || "";
        if (!this.env.isSmall || className.includes("o_action_delegate_scroll")) {
            return className;
        }
        return `${className} o_action_delegate_scroll`.trim();
    }
}

export class MTTransactionDashboardKanbanRenderer extends KanbanRenderer {
    static template = "money_tracker_integration.MTTransactionKanbanView";
    static components = Object.assign({}, KanbanRenderer.components, { MTTransactionDashboard });
}

export const MTTransactionDashboardKanbanView = {
    ...kanbanView,
    Controller: MTTransactionDashboardKanbanController,
    Model: MTTransactionKanbanModel,
    Renderer: MTTransactionDashboardKanbanRenderer,
};

registry.category("views").add("mt_transaction_dashboard_kanban", MTTransactionDashboardKanbanView);
