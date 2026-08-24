import logging

from odoo import models, fields, api
from odoo.exceptions import ValidationError

_logger = logging.getLogger(__name__)


class MoneyTrackerCurrency(models.Model):
    _name = "money_tracker.currency"
    _description = "Money Tracker Currency"

    code = fields.Char(
        string="Code",
        required=True,
        copy=False,
    )
    currency_name = fields.Char(
        string="Currency Name",
        required=True,
        copy=False,
    )
    currency_name_short = fields.Char(
        string="Currency Name Short",
        copy=False,
    )
    locale = fields.Char(
        string="Locale",
        copy=False,
    )
    display_symbol = fields.Char(
        string="Display Symbol",
        copy=False,
    )
    symbol = fields.Char(
        string="Symbol",
        compute="_compute_symbol",
        store=True,
    )
    owner_id = fields.Many2one(
        comodel_name="res.users",
        string="Owner",
        required=True,
        default=lambda self: self.env.user.id,
    )

    _sql_constraints = [
        ('unique_code_per_owner', 'UNIQUE(code, owner_id)', "Currency's Code must be unique"),
    ]

    @api.model
    def sync_currencies(self):
        current_user = self.env.user
        current_user._check_api_token_empty()
        currencies_data, metadata = current_user.get_mt_currencies()
        try:
            self.env['money_tracker.currency'].search(domain=[
                ('owner_id', '=', current_user.id),
            ]).unlink()
            self.env[self._name].with_user(user=current_user).create(currencies_data)
        except Exception as e:
            _logger.exception(msg=e)
            raise ValidationError(e)

    @api.depends('display_symbol')
    def _compute_symbol(self):
        for currency in self:
            currency.symbol = ''.join([
                chr(int(symbol_code, 16)) for symbol_code in currency.display_symbol.split(',')
            ])
