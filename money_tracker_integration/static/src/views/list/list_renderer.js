/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { _t } from "@web/core/l10n/translation";
import { ListRenderer } from "@web/views/list/list_renderer";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { onMounted, onWillStart, onWillUpdateProps, useState } from "@odoo/owl";

const formatters = registry.category("formatters");
const RES_MODEL = "money_tracker.account";
const FIELD_NAME = "currency_amount";
const TRANSACTION_RES_MODEL = "money_tracker.transaction";
const TRANSACTION_AMOUNT_FIELD = "amount";

ListRenderer.groupRowTemplate = "money_tracker_integration.ListRenderer.GroupRow";

patch(ListRenderer.prototype, {
    setup() {
        super.setup(...arguments);
        this.orm = useService("orm");
        this.mtAccountFooter = useState({
            key: null,
            total: null,
        });
        onWillStart(() => this.loadMTAccountFooterTotal(this.props));
        onWillUpdateProps((nextProps) => this.loadMTAccountFooterTotal(nextProps));
        onMounted(() => this.markMTTransactionListView());
    },

    get aggregates() {
        const aggregates = super.aggregates;

        if (
            this.props.list.resModel !== RES_MODEL ||
            this.props.list.selection?.length ||
            !(FIELD_NAME in aggregates) ||
            this.mtAccountFooter.total === null
        ) {
            return aggregates;
        }

        const column = this.allColumns.find((col) => col.name === FIELD_NAME);
        const field = this.fields[FIELD_NAME];
        const formatter =
            formatters.get(column?.widget, false) || formatters.get(field.type, false);

        aggregates[FIELD_NAME] = {
            ...aggregates[FIELD_NAME],
            value: formatter
                ? formatter(this.mtAccountFooter.total, { escape: true })
                : this.mtAccountFooter.total,
        };

        return aggregates;
    },

    isMTTransactionAmountAggregate(group, column) {
        return (
            this.props.list.resModel === TRANSACTION_RES_MODEL &&
            column.name === TRANSACTION_AMOUNT_FIELD &&
            typeof group.aggregates[TRANSACTION_AMOUNT_FIELD] === "object"
        );
    },

    hasMTTransactionGroupAmountAggregate(group) {
        return (
            this.props.list.resModel === TRANSACTION_RES_MODEL &&
            typeof group.aggregates[TRANSACTION_AMOUNT_FIELD] === "object" &&
            Boolean(
                group.aggregates[TRANSACTION_AMOUNT_FIELD].expense ||
                    group.aggregates[TRANSACTION_AMOUNT_FIELD].income
            )
        );
    },

    getMTTransactionGroupAmountAggregateLines(group) {
        const column = this.allColumns.find((col) => col.name === TRANSACTION_AMOUNT_FIELD);
        if (!column) {
            return [];
        }
        const { widget, attrs } = column;
        const field = this.props.list.fields[column.name];
        const formatter = formatters.get(widget, false) || formatters.get(field.type, false);
        const formatOptions = {
            digits: attrs.digits ? JSON.parse(attrs.digits) : field.digits,
            escape: true,
        };
        const formatAmount = (amount) => formatter ? formatter(amount, formatOptions) : amount;
        const aggregate = group.aggregates[TRANSACTION_AMOUNT_FIELD];
        const lines = [];

        if (aggregate.expense) {
            lines.push({
                label: _t("Chi tiêu"),
                value: formatAmount(Math.abs(aggregate.expense)),
            });
        }
        if (aggregate.income) {
            lines.push({
                label: _t("Thu nhập"),
                value: formatAmount(aggregate.income),
            });
        }
        return lines;
    },

    markMTTransactionListView() {
        if (this.props.list.resModel !== TRANSACTION_RES_MODEL || !this.tableRef?.el) {
            return;
        }
        const renderer = this.tableRef.el.closest(".o_renderer_with_searchpanel.o_list_view");
        renderer?.classList.add("o_mt_transaction_list_view");
    },

    async loadMTAccountFooterTotal(props) {
        const list = props.list;
        if (list.resModel !== RES_MODEL) {
            return;
        }
        const key = JSON.stringify({
            domain: list.domain,
            context: list.context,
        });
        if (this.mtAccountFooter.key === key) {
            return;
        }
        this.mtAccountFooter.key = key;
        this.mtAccountFooter.total = null;
        const total = await this.orm.call(
            RES_MODEL,
            "get_included_balance_total",
            [list.domain],
            { context: list.context }
        );
        if (this.mtAccountFooter.key === key) {
            this.mtAccountFooter.total = total;
        }
    },
});
