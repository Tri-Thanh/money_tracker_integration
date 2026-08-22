import {DropdownItem} from "@web/core/dropdown/dropdown_item";
import {registry} from "@web/core/registry";
import {STATIC_ACTIONS_GROUP_NUMBER} from "@web/search/action_menus/action_menus";

import {Component} from "@odoo/owl";

const cogMenuRegistry = registry.category("cogMenu");

/**
 * 'Money Tracker Category' menu
 *
 * This component is used to synchronize categories with Money Tracker.
 * @extends Component
 */
export class MTSyncCategory extends Component {
    static template = "web.MTSyncCategory";
    static components = {DropdownItem};
    static props = {};

    //---------------------------------------------------------------------
    // Protected
    //---------------------------------------------------------------------

    async onSyncCategory() {
        try {
            await this.env.model.orm.call(
                this.env.model.config.resModel,
                "sync_categories",
            );

            this.env.services.notification.add(
                "Currency synchronization completed successfully.",
                {
                    title: "Success",
                    type: "success",
                    sticky: true,
                }
            );
        } catch (error) {
            this.env.services.notification.add(
                "Category synchronization failed.",
                {
                    title: "Error",
                    type: "danger",
                    sticky: true,
                }
            );
            throw error;
        }
    }
}

export const mtSyncCategoryItem = {
    Component: MTSyncCategory,
    groupNumber: STATIC_ACTIONS_GROUP_NUMBER,
    isDisplayed: async (env) =>
        env.config.viewType === "list" &&
        !env.model.root.selection.length &&
        env.model.config.resModel === 'money_tracker.category'
};

cogMenuRegistry.add("mt-sync-category-menu", mtSyncCategoryItem, {sequence: 36});
