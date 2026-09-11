from odoo import models, api
from odoo.exceptions import ValidationError
from odoo.tools import SQL


class MoneyTrackerMixin(models.AbstractModel):
    _name = "money_tracker.mixin"
    _description = "Money Tracker Mixin"

    @api.model
    def sync_data(self):
        raise NotImplementedError("`sync_data` method is not implemented.")

    def action_open_mt_data(self):
        raise NotImplementedError("`action_open_mt_data` method is not implemented.")

    @api.model
    def action_open_data(self):
        try:
            self.sync_data()
            return self.action_open_mt_data()
        except Exception as e:
            raise ValidationError(e)

    @api.autovacuum
    def _gc_inactive_records(self):
        if 'active' in self._fields:
            self.env.cr.execute(
                SQL(
                    "DELETE FROM %s WHERE active IS NOT TRUE;",
                    SQL.identifier(
                        name=self._table,
                    ),
                )
            )
