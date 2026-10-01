/** @odoo-module **/

import { Component, onWillStart, onWillUpdateProps, useState } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";
import { useBus, useService } from "@web/core/utils/hooks";

export class MTAccountDashboard extends Component {
    static template = "money_tracker_integration.MTAccountDashboard";
    static props = ["list?"];

    setup() {
        this.orm = useService("orm");
        this.dashboardData = useState({});
        this.dashboardLabels = {
            netAssets: _t("Net Assets"),
        };
        this.dashboardItems = [
            {
                label: _t("Assets"),
                valueKey: "asset_total",
            },
            {
                label: _t("Receivables"),
                valueKey: "receivable_total",
            },
            {
                label: _t("Liabilities"),
                valueKey: "liability_total",
            },
        ];
        this.dashboardKey = null;

        onWillStart(() => this.loadDashboard(this.props));
        onWillUpdateProps((nextProps) => this.loadDashboard(nextProps));
        useBus(this.env.model.bus, "update", () => this.loadDashboard(this.props, true));
    }

    async loadDashboard(props, force = false) {
        const list = props.list || this.env.model.root;
        const key = JSON.stringify({
            domain: list.domain,
            context: list.context,
        });
        if (!force && this.dashboardKey === key) {
            return;
        }
        this.dashboardKey = key;

        const dashboardData = await this.orm.call(
            "money_tracker.account",
            "retrieve_dashboard",
            [list.domain],
            { context: list.context }
        );
        if (this.dashboardKey === key) {
            Object.assign(this.dashboardData, dashboardData);
        }
    }
}
