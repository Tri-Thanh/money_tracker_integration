/** @odoo-module **/

import { Dialog } from "@web/core/dialog/dialog";
import { _t } from "@web/core/l10n/translation";
import { useBus, useService } from "@web/core/utils/hooks";
import { formatPercentage } from "@web/views/fields/formatters";
import { Component, onWillStart, onWillUpdateProps, useState } from "@odoo/owl";

const { DateTime } = luxon;

const MONTHS = [
    { value: 1, label: _t("Tháng 1") },
    { value: 2, label: _t("Tháng 2") },
    { value: 3, label: _t("Tháng 3") },
    { value: 4, label: _t("Tháng 4") },
    { value: 5, label: _t("Tháng 5") },
    { value: 6, label: _t("Tháng 6") },
    { value: 7, label: _t("Tháng 7") },
    { value: 8, label: _t("Tháng 8") },
    { value: 9, label: _t("Tháng 9") },
    { value: 10, label: _t("Tháng 10") },
    { value: 11, label: _t("Tháng 11") },
    { value: 12, label: _t("Tháng 12") },
];

export class MTTransactionMonthFilterDialog extends Component {
    static template = "money_tracker_integration.MTTransactionMonthFilterDialog";
    static components = { Dialog };
    static props = {
        close: Function,
        confirm: Function,
        initialMonth: Number,
        initialYear: Number,
    };

    setup() {
        this.months = MONTHS;
        this.labels = {
            cancel: _t("Hủy"),
            confirm: _t("Xác nhận"),
            previousYear: _t("Năm trước"),
            nextYear: _t("Năm sau"),
        };
        this.state = useState({
            month: this.props.initialMonth,
            year: this.props.initialYear,
        });
    }

    get title() {
        return _t("tháng %(month)s năm %(year)s", {
            month: this.state.month,
            year: this.state.year,
        });
    }

    get years() {
        const years = [];
        for (let year = this.state.year - 5; year <= this.state.year + 5; year++) {
            years.push(year);
        }
        return years;
    }

    selectMonth(month) {
        this.state.month = month;
    }

    previousYear() {
        this.state.year -= 1;
    }

    nextYear() {
        this.state.year += 1;
    }

    onYearChange(ev) {
        this.state.year = Number(ev.target.value);
    }

    confirm() {
        this.props.confirm({
            month: this.state.month,
            year: this.state.year,
        });
        this.props.close();
    }
}

export class MTTransactionDashboard extends Component {
    static template = "money_tracker_integration.MTTransactionDashboard";
    static props = ["list?"];

    setup() {
        const now = DateTime.local();
        this.orm = useService("orm");
        this.dialog = useService("dialog");
        this.dashboardData = useState({});
        this.filter = useState({
            month: null,
            year: null,
        });
        this.defaultFilter = {
            month: now.month,
            year: now.year,
        };
        this.dashboardLabels = {
            overview: _t("Tổng quan tài chính"),
            filterMonth: _t("Lọc giao dịch theo tháng"),
            expense: _t("Chi tiêu"),
            income: _t("Thu nhập"),
            netFlow: _t("Dòng tiền ròng"),
            netFlowNote: _t("Thu nhập - chi tiêu"),
            ratio: _t("Tỷ lệ chi / thu"),
            noPreviousMonthData: _t("Không có dữ liệu tháng trước"),
        };
        this.dashboardKey = null;
        this.dashboardRequestId = 0;

        onWillStart(() => {
            if (!this.ensureDefaultMonthFilter()) {
                this.loadDashboard(this.props);
            }
        });
        onWillUpdateProps((nextProps) => this.loadDashboard(nextProps));
        useBus(this.env.model.bus, "update", () => this.loadDashboard(this.props));
    }

    get periodEyebrow() {
        if (!this.hasActiveMonthFilter) {
            return "";
        }
        return _t("THÁNG %(month)s · %(year)s", {
            month: this.filter.month,
            year: this.filter.year,
        });
    }

    get activeFilterLabel() {
        if (!this.hasActiveMonthFilter) {
            return "";
        }
        return _t("Tháng %(month)s/ %(year)s", {
            month: this.filter.month,
            year: this.filter.year,
        });
    }

    get hasActiveMonthFilter() {
        return Boolean(this.filter.month && this.filter.year);
    }

    get dashboardCards() {
        return [
            {
                key: "expense",
                label: this.dashboardLabels.expense,
                value: this.dashboardData.expense_total,
                valueClass: "o_mt_transaction_dashboard_value_expense",
                ...(this.hasActiveMonthFilter ? {
                    deltaRatio: this.dashboardData.expense_delta_ratio,
                } : {}),
            },
            {
                key: "income",
                label: this.dashboardLabels.income,
                value: this.dashboardData.income_total,
                valueClass: "o_mt_transaction_dashboard_value_income",
                ...(this.hasActiveMonthFilter ? {
                    deltaRatio: this.dashboardData.income_delta_ratio,
                } : {}),
            },
            {
                key: "net_flow",
                label: this.dashboardLabels.netFlow,
                value: this.dashboardData.net_flow_total,
                valueClass: this.netFlowValueClass,
                description: this.dashboardLabels.netFlowNote,
            },
        ];
    }

    get netFlowValueClass() {
        const amount = this.dashboardData.net_flow_amount || 0;
        if (amount > 0) {
            return "o_mt_transaction_dashboard_value_positive";
        }
        if (amount < 0) {
            return "o_mt_transaction_dashboard_value_negative";
        }
        return "o_mt_transaction_dashboard_value_neutral";
    }

    get expenseIncomeRatioLabel() {
        const ratio = this.dashboardData.expense_income_ratio;
        if (ratio === false || ratio === undefined || ratio === null) {
            return _t("N/A");
        }
        return formatPercentage(ratio, { digits: [false, 0] });
    }

    get expenseIncomeRatioStyle() {
        const ratio = this.dashboardData.expense_income_ratio || 0;
        const progress = Math.max(0, Math.min(ratio * 100, 100));
        return `--mt-transaction-ratio-progress: ${progress}%`;
    }

    get currentPeriod() {
        if (!this.hasActiveMonthFilter) {
            return null;
        }
        const start = DateTime.local(this.filter.year, this.filter.month, 1);
        return {
            start,
            end: start.plus({ months: 1 }),
        };
    }

    get previousPeriod() {
        if (!this.hasActiveMonthFilter) {
            return null;
        }
        const start = DateTime.local(this.filter.year, this.filter.month, 1).minus({ months: 1 });
        return {
            start,
            end: start.plus({ months: 1 }),
        };
    }

    openFilterDialog() {
        const initialFilter = this.hasActiveMonthFilter ? this.filter : this.defaultFilter;
        this.dialog.add(MTTransactionMonthFilterDialog, {
            initialMonth: initialFilter.month,
            initialYear: initialFilter.year,
            confirm: (filter) => this.applyMonthFilter(filter),
        });
    }

    ensureDefaultMonthFilter() {
        const searchModel = this.env.searchModel;
        if (!searchModel || this.syncActiveMonthFilter(searchModel)) {
            return false;
        }
        this.applyMonthFilter({
            month: this.defaultFilter.month,
            year: this.defaultFilter.year,
        });
        return true;
    }

    syncActiveMonthFilter(searchModel) {
        const domain = searchModel.domain || [];
        const period = this.syncFilterFromDomain(domain);
        if (period) {
            return true;
        }
        return Boolean(this.getDateConditions(domain).length);
    }

    applyMonthFilter({ month, year }) {
        const searchModel = this.env.searchModel;
        if (!searchModel) {
            return;
        }
        this.filter.month = month;
        this.filter.year = year;
        this.removeMonthFilter(searchModel);

        const start = DateTime.local(year, month, 1);
        const end = start.plus({ months: 1 });
        searchModel.createNewFilters([
            {
                description: _t("Tháng %(month)s/ %(year)s", { month, year }),
                domain: [
                    ["transaction_date", ">=", start.toISODate()],
                    ["transaction_date", "<", end.toISODate()],
                ],
                invisible: "True",
                isMTTransactionMonthFilter: true,
            },
        ]);
    }

    formatDeltaRatio(deltaRatio) {
        if (deltaRatio === false || deltaRatio === undefined || deltaRatio === null) {
            return this.dashboardLabels.noPreviousMonthData;
        }
        return _t("%(percent)s so với tháng trước", {
            percent: formatPercentage(Math.abs(deltaRatio), { digits: [false, 1] }),
        });
    }

    getDeltaTrendClass(deltaRatio) {
        if (deltaRatio === false || deltaRatio === undefined || deltaRatio === null || deltaRatio === 0) {
            return "o_mt_transaction_dashboard_trend_neutral";
        }
        return deltaRatio > 0
            ? "o_mt_transaction_dashboard_trend_up"
            : "o_mt_transaction_dashboard_trend_down";
    }

    getDeltaIconClass(deltaRatio) {
        if (deltaRatio === false || deltaRatio === undefined || deltaRatio === null || deltaRatio === 0) {
            return "fa fa-minus";
        }
        return deltaRatio > 0 ? "fa fa-arrow-up" : "fa fa-arrow-down";
    }

    getMonthPeriodFromDomain(domain) {
        const conditions = this.getDateConditions(domain);
        if (conditions.length !== 2) {
            return null;
        }
        const startConditions = conditions.filter((condition) => (
            condition[0] === "transaction_date" &&
            condition[1] === ">="
        ));
        const endConditions = conditions.filter((condition) => (
            condition[0] === "transaction_date" &&
            ["<", "<="].includes(condition[1])
        ));
        for (const startCondition of startConditions) {
            const start = this.parseDomainDate(startCondition[2]);
            if (!start?.isValid || start.day !== 1) {
                continue;
            }
            const nextMonthStart = start.plus({ months: 1 });
            const monthEnd = nextMonthStart.minus({ days: 1 });
            for (const endCondition of endConditions) {
                const end = this.parseDomainDate(endCondition[2]);
                if (!end?.isValid) {
                    continue;
                }
                const matchesExclusiveEnd = (
                    endCondition[1] === "<" &&
                    end.toISODate() === nextMonthStart.toISODate()
                );
                const matchesInclusiveEnd = (
                    endCondition[1] === "<=" &&
                    end.toISODate() === monthEnd.toISODate()
                );
                if (matchesExclusiveEnd || matchesInclusiveEnd) {
                    return {
                        month: start.month,
                        year: start.year,
                        start,
                        end: nextMonthStart,
                        endCondition,
                        startCondition,
                    };
                }
            }
        }
        return null;
    }

    getDateConditions(domain) {
        const conditions = [];
        const visitDomainPart = (domainPart) => {
            if (!Array.isArray(domainPart)) {
                return;
            }
            if (
                domainPart.length >= 3 &&
                domainPart[0] === "transaction_date" &&
                typeof domainPart[1] === "string"
            ) {
                conditions.push(domainPart);
                return;
            }
            domainPart.forEach(visitDomainPart);
        };
        visitDomainPart(domain);
        return conditions;
    }

    parseDomainDate(value) {
        if (typeof value !== "string") {
            return null;
        }
        return DateTime.fromISO(value.slice(0, 10));
    }

    syncFilterFromDomain(domain) {
        const period = this.getMonthPeriodFromDomain(domain);
        if (period) {
            this.filter.month = period.month;
            this.filter.year = period.year;
        } else {
            this.filter.month = null;
            this.filter.year = null;
        }
        return period;
    }

    buildPreviousMonthDomain(domain, period) {
        if (!period) {
            return null;
        }
        const previousPeriod = {
            start: period.start.minus({ months: 1 }),
            end: period.end.minus({ months: 1 }),
        };
        return this.replacePeriodDomain(
            domain,
            period.start.toISODate(),
            period.end.toISODate(),
            previousPeriod.start.toISODate(),
            previousPeriod.end.toISODate()
        );
    }

    replacePeriodDomain(domain, currentStart, currentEnd, previousStart, previousEnd) {
        if (!Array.isArray(domain)) {
            return domain;
        }
        if (domain[0] === "transaction_date" && domain[1] === ">=" && domain[2] === currentStart) {
            return ["transaction_date", ">=", previousStart];
        }
        if (domain[0] === "transaction_date" && domain[1] === "<" && domain[2] === currentEnd) {
            return ["transaction_date", "<", previousEnd];
        }
        const currentEndInclusive = DateTime.fromISO(currentEnd).minus({ days: 1 }).toISODate();
        const previousEndInclusive = DateTime.fromISO(previousEnd).minus({ days: 1 }).toISODate();
        if (
            domain[0] === "transaction_date" &&
            domain[1] === "<=" &&
            domain[2] === currentEndInclusive
        ) {
            return ["transaction_date", "<=", previousEndInclusive];
        }
        return domain.map((domainPart) => (
            this.replacePeriodDomain(domainPart, currentStart, currentEnd, previousStart, previousEnd)
        ));
    }

    removeMonthFilter(searchModel) {
        const monthFilterGroupIds = new Set(
            Object.values(searchModel.searchItems)
                .filter((searchItem) => searchItem.isMTTransactionMonthFilter)
                .map((searchItem) => searchItem.groupId)
        );
        if (!monthFilterGroupIds.size) {
            return;
        }
        searchModel.query = searchModel.query.filter((queryElem) => {
            const searchItem = searchModel.searchItems[queryElem.searchItemId];
            return !monthFilterGroupIds.has(searchItem?.groupId);
        });
    }

    async loadDashboard(props, force = false) {
        const list = props.list || this.env.model.root;
        const dashboardDomain = list.domain || [];
        const period = this.syncFilterFromDomain(dashboardDomain);
        const previousDomain = this.buildPreviousMonthDomain(dashboardDomain, period);
        const key = JSON.stringify({
            domain: dashboardDomain,
            previousDomain,
            context: list.context,
        });
        if (!force && this.dashboardKey === key) {
            return;
        }
        this.dashboardKey = key;
        const requestId = ++this.dashboardRequestId;

        const dashboardData = await this.orm.silent.call(
            "money_tracker.transaction",
            "retrieve_dashboard",
            [dashboardDomain, previousDomain],
            { context: list.context }
        );
        if (this.dashboardKey === key && this.dashboardRequestId === requestId) {
            Object.assign(this.dashboardData, dashboardData);
        }
    }
}
