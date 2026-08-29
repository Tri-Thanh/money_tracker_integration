/** @odoo-module **/

import { Component } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { standardFieldProps } from "@web/views/fields/standard_field_props";

export class MTDisplayRemark extends Component {
    static template = "money_tracker_integration.MTDisplayRemark";

    static props = {
        ...standardFieldProps,
    };
}

export const mtDisplayRemark = {
    component: MTDisplayRemark,
    supportedTypes: [
        "char",
    ],
    fieldDependencies: [
        {
            name: "remark",
            type: "char",
        },
    ],
};

registry.category("fields").add(
    "mt_display_remark",
    mtDisplayRemark
);