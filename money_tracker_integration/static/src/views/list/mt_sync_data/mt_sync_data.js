import {DropdownItem} from "@web/core/dropdown/dropdown_item";
import {registry} from "@web/core/registry";
import {STATIC_ACTIONS_GROUP_NUMBER} from "@web/search/action_menus/action_menus";

import {Component} from "@odoo/owl";

const cogMenuRegistry = registry.category("cogMenu");

/**
 * 'Money Tracker Transaction' menu
 *
 * This component is used to synchronize transactions with Money Tracker.
 * @extends Component
 */
export class MTSyncData extends Component {
    static template = "money_tracker_integration.MTSyncData";
    static components = {DropdownItem};
    static props = {};

    //---------------------------------------------------------------------
    // Protected
    //---------------------------------------------------------------------

    async onSyncData() {
        try {
            await this.env.model.orm.call(
                this.env.model.config.resModel,
                "sync_data",
            );

            await this.env.model.load();

            this.env.services.notification.add(
                "Data Synchronization completed",
                {
                    title: "Success",
                    type: "success",
                    autocloseDelay: 5000,
                }
            );
        } catch (error) {
            this.env.services.notification.add(
                "Data Synchronization failed.",
                {
                    title: "Error",
                    type: "danger",
                    autocloseDelay: 5000,
                }
            );
            throw error;
        }
    }
}

export const mtSyncDataItem = {
    Component: MTSyncData,
    groupNumber: STATIC_ACTIONS_GROUP_NUMBER,
    isDisplayed: async (env) =>
        env.config.viewType === "list" &&
        !env.model.root.selection.length &&
        [
            'money_tracker.currency',
            'money_tracker.category',
            'money_tracker.account',
            'money_tracker.transaction',
        ].includes(env.model.config.resModel)
};

cogMenuRegistry.add(
    "mt-sync-transaction-menu",
    mtSyncDataItem,
    {
        sequence: 36
    }
);
