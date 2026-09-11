/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { ListRenderer } from "@web/views/list/list_renderer";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { onWillStart, onWillUpdateProps, useState } from "@odoo/owl";

const formatters = registry.category("formatters");
const RES_MODEL = "money_tracker.account";
const FIELD_NAME = "currency_amount";

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
