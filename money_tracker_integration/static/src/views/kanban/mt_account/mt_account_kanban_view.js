/** @odoo-module **/

import { registry } from "@web/core/registry";
import { kanbanView } from "@web/views/kanban/kanban_view";
import { KanbanController } from "@web/views/kanban/kanban_controller";
import { KanbanRenderer } from "@web/views/kanban/kanban_renderer";
import { MTAccountDashboard } from "./mt_account_dashboard";
import { useSubEnv } from "@odoo/owl";

export class MTAccountDashboardKanbanController extends KanbanController {
    setup() {
        super.setup(...arguments);
        useSubEnv({ model: this.model });
    }
}

export class MTAccountDashboardKanbanRenderer extends KanbanRenderer {
    static template = "money_tracker_integration.MTAccountKanbanView";
    static components = Object.assign({}, KanbanRenderer.components, { MTAccountDashboard });
}

export const MTAccountDashboardKanbanView = {
    ...kanbanView,
    Controller: MTAccountDashboardKanbanController,
    Renderer: MTAccountDashboardKanbanRenderer,
};

registry.category("views").add("mt_account_dashboard_kanban", MTAccountDashboardKanbanView);
