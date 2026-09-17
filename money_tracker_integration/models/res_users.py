import logging

from odoo import models, fields, api
from odoo.exceptions import UserError, ValidationError

from ..services.money_tracker import MoneyTrackerService

_logger = logging.getLogger(__name__)


class ResUsers(models.Model):
    _inherit = "res.users"

    money_tracker_api_token = fields.Char(
        string="Money Tracker API Token",
        copy=False,
    )

    @api.model
    def trigger_mt_data_synchronization(self):
        mt_prime_users = self.env[self._name].search(
            domain=[
                ('money_tracker_api_token', 'not in', (False, None, '')),
                ('active', '=', True),
            ],
        )
        print(mt_prime_users.mapped(lambda u: (u.name, u.money_tracker_api_token)))
        for mt_prime_user in mt_prime_users:
            mt_prime_user._trigger_mt_data_synchronization()

    def _trigger_mt_data_synchronization(self):
        self.ensure_one()
        mt_models = {
            'money_tracker.currency': "sync_currencies",
            'money_tracker.category': "sync_categories",
            'money_tracker.account': "sync_accounts",
            'money_tracker.transaction': "sync_transactions",
        }
        for mt_model, mt_sync_action in mt_models.items():
            if not hasattr(self.env[mt_model], mt_sync_action):
                _logger.exception(msg=NotImplementedError("action `{}` is not implemented.".format(mt_sync_action)))
                continue
            try:
                getattr(self.env[mt_model].with_user(user=self), mt_sync_action)()
            except Exception as e:
                _logger.exception(msg=e)

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
