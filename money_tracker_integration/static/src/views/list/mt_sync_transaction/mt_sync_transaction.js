import {DropdownItem} from "@web/core/dropdown/dropdown_item";
import {registry} from "@web/core/registry";
import {STATIC_ACTIONS_GROUP_NUMBER} from "@web/search/action_menus/action_menus";

import {Component} from "@odoo/owl";

const cogMenuRegistry = registry.category("cogMenu");

/**
 * 'Money Tracker Transaction' menu
 *
 * This component is used to synchronize transactinos with Money Tracker.
 * @extends Component
 */
export class MTSyncTransaction extends Component {
    static template = "money_tracker_integration.MTSyncTransaction";
    static components = {DropdownItem};
    static props = {};

    //---------------------------------------------------------------------
    // Protected
    //---------------------------------------------------------------------

    async onSyncTransactions() {
        // get all transactions from Money Tracker app
        try {
            await this.env.model.orm.call(
                this.env.model.config.resModel,
                "sync_transactions",
            );

            await this.env.model.load();

            this.env.services.notification.add(
                "All Transactions synchronization completed successfully.",
                {
                    title: "Success",
                    type: "success",
                    sticky: true,
                }
            );
        } catch (error) {
            this.env.services.notification.add(
                "Transaction Synchronization failed.",
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

export const mtSyncTransactionItem = {
    Component: MTSyncTransaction,
    groupNumber: STATIC_ACTIONS_GROUP_NUMBER,
    isDisplayed: async (env) =>
        env.config.viewType === "list" &&
        !env.model.root.selection.length &&
        env.model.config.resModel === 'money_tracker.transaction'
};

cogMenuRegistry.add("mt-sync-transaction-menu", mtSyncTransactionItem, {sequence: 38});
