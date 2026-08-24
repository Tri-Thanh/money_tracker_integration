import {DropdownItem} from "@web/core/dropdown/dropdown_item";
import {registry} from "@web/core/registry";
import {STATIC_ACTIONS_GROUP_NUMBER} from "@web/search/action_menus/action_menus";

import {Component} from "@odoo/owl";

const cogMenuRegistry = registry.category("cogMenu");

/**
 * 'Money Tracker Currency' menu
 *
 * This component is used to synchronize currencies with Money Tracker.
 * @extends Component
 */
export class MTSyncCurrency extends Component {
    static template = "web.MTSyncCurrency";
    static components = {DropdownItem};
    static props = {};

    //---------------------------------------------------------------------
    // Protected
    //---------------------------------------------------------------------

    async onSyncCurrency() {
        try {
            await this.env.model.orm.call(
                this.env.model.config.resModel,
                "sync_currencies",
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
                "Currency synchronization failed.",
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

export const mtSyncCurrencyItem = {
    Component: MTSyncCurrency,
    groupNumber: STATIC_ACTIONS_GROUP_NUMBER,
    isDisplayed: async (env) =>
        env.config.viewType === "list" &&
        !env.model.root.selection.length &&
        env.model.config.resModel === 'money_tracker.currency'
};

cogMenuRegistry.add("mt-sync-currency-menu", mtSyncCurrencyItem, {sequence: 36});
