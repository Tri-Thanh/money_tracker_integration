from odoo import models, fields, api
from odoo.exceptions import UserError, ValidationError

from ..services.money_tracker import MoneyTrackerService


class ResUsers(models.Model):
    _inherit = "res.users"

    money_tracker_api_token = fields.Char(
        string="Money Tracker API Token",
        copy=False,
    )

    def _check_api_token_empty(self):
        self.ensure_one()
        if not self.money_tracker_api_token:
            raise UserError("Setup your Money Tracker API Token first")

    def check_mt_response(self):
        self._check_api_token_empty()
        self.get_mt_currencies()

    def get_mt_currencies(self):
        self.ensure_one()
        service = MoneyTrackerService(
            token=self.money_tracker_api_token,
            env=self.env,
        )
        return service.get_currencies()

    def get_mt_categories(self):
        self.ensure_one()
        service = MoneyTrackerService(
            env=self.env,
            token=self.money_tracker_api_token,
        )
        return service.get_categories()

    def get_mt_cashbook_categories(self):
        self.ensure_one()
        service = MoneyTrackerService(
            env=self.env,
            token=self.money_tracker_api_token,
        )
        return service.get_cash_book_categories()

    def get_mt_transactions(self, **params):
        self.ensure_one()
        service = MoneyTrackerService(
            env=self.env,
            token=self.money_tracker_api_token,
        )
        return service.get_transactions(**params)

    def get_mt_accounts(self):
        self.ensure_one()
        service = MoneyTrackerService(
            env=self.env,
            token=self.money_tracker_api_token,
        )
        return service.get_accounts()
