/** @odoo-module **/

import { Component } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { patch } from "@web/core/utils/patch";
import { standardFieldProps } from "@web/views/fields/standard_field_props";
import { ListRenderer } from "@web/views/list/list_renderer";

const DEFAULT_REMARK_FIELD = "remark";
const RELATIONAL_FIELD_TYPES = [
    "many2one",
    "many2many",
    "one2many",
    "reference",
    "many2one_reference",
];

function getFieldName(value, fallback = "") {
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export class MTDisplayRemark extends Component {
    static template = "money_tracker_integration.MTDisplayRemark";

    static props = {
        ...standardFieldProps,
        remarkField: { type: String, optional: true },
        remarkFieldString: { type: String, optional: true },
        showRemarkLabel: { type: Boolean, optional: true },
    };

    get remarkLabel() {
        if (this.props.showRemarkLabel === false) {
            return "";
        }
        const fieldName = getFieldName(this.props.remarkField, DEFAULT_REMARK_FIELD);
        return this.props.remarkFieldString || this.props.record.fields[fieldName]?.string || "";
    }

    get remark() {
        return this.getDisplayValue(this.props.remarkField || DEFAULT_REMARK_FIELD);
    }

    getDisplayValue(fieldName) {
        fieldName = getFieldName(fieldName);
        if (!fieldName) {
            return "";
        }
        const field = this.props.record.fields[fieldName];
        const value = this.props.record.data[fieldName];

        if (!field || !value) {
            return "";
        }
        if (!RELATIONAL_FIELD_TYPES.includes(field.type)) {
            return value;
        }
        if (Array.isArray(value)) {
            return value[1] || "";
        }
        if (typeof value !== "object") {
            return "";
        }
        if ("displayName" in value) {
            return value.displayName || "";
        }

        if ("display_name" in value) {
            return value.display_name || "";
        }
        return "";
    }
}

export const mtDisplayRemark = {
    component: MTDisplayRemark,
    supportedTypes: [
        "char",
    ],
    extractProps: ({ options }) => ({
        remarkField: options.remark_field,
        showRemarkLabel: options.show_remark_label !== false,
    }),
    fieldDependencies: ({ options }) =>
        [
            getFieldName(options.remark_field, DEFAULT_REMARK_FIELD)
        ].filter(Boolean).map((name) => ({
            name,
            type: "char",
        })),
};

registry.category("fields").add(
    "mt_display_remark",
    mtDisplayRemark
);

patch(ListRenderer.prototype, {
    getFieldProps(record, column) {
        const props = super.getFieldProps(record, column);
        if (column.widget !== "mt_display_remark") {
            return props;
        }

        const remarkField = getFieldName(column.options?.remark_field, DEFAULT_REMARK_FIELD);
        const remarkColumn = this.allColumns.find(
            (candidate) => candidate.type === "field" && candidate.name === remarkField
        );

        return {
            ...props,
            remarkFieldString: remarkColumn?.string || "",
        };
    },
});
