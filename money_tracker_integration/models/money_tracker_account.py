import logging

from odoo import models, fields, api
from odoo.exceptions import ValidationError

_logger = logging.getLogger(__name__)


class MoneyTrackerAccount(models.Model):
    _name = "money_tracker.account"
    _description = "Money Tracker Account"
    _rec_name = "name"
    _order = "order_num"

    owner_id = fields.Many2one(
        comodel_name="res.users",
        string="Owner",
        default=lambda self: self.env.user,
        required=True,
    )
    # raw fields
    accountServerID = fields.Char(
        string="Account Server ID",
        readonly=True,
    )
    accountID = fields.Char(
        string="Account ID",
        readonly=True,
    )
    userID = fields.Char(
        string="User ID",
    )
    type = fields.Selection(
        selection=[
            ('0', "Default"),
            ('1', "Cash"),
            ('2', "Debit"),
            ('3', "Credit"),
            ('4', "Virtual"),
            ('5', "Investment"),
            ('6', "Receivable"),
            ('7', "Payable"),
        ],
        string="Type",
        readonly=True,
    )
    name = fields.Char(
        string="Account Name",
        readonly=True,
    )
    icon = fields.Char(
        string="Account Icon Path",
        readonly=True,
    )
    currencyID = fields.Char(
        string="Currency ID",
        readonly=True,
    )
    currency_code = fields.Char(
        string="Currency Code",
        readonly=True,
    )
    currency_amount = fields.Float(
        string="Currency Amount",
        readonly=True,
    )
    is_not_include_in_total_balance = fields.Boolean(
        string="Is Not Include in Total Balance",
        readonly=True,
    )
    remark = fields.Char(
        string="Remark",
        readonly=True,
    )
    order_num = fields.Integer(
        string="Order Number",
        default=0,
    )
    amount_time = fields.Char(
        string="Amount Time",
        readonly=True,
    )
    is_hide_deleted = fields.Boolean(
        string="Is Hide Deleted",
        readonly=True,
    )
    add_time = fields.Char(
        string="Add Time",
        readonly=True,
    )
    update_time = fields.Char(
        string="Update Time",
    )
    server_add_time = fields.Char(
        string="server Add Time",
        readonly=True,
    )
    server_update_time = fields.Char(
        string="server Update Time",
        readonly=True,
    )
    is_server_delete = fields.Boolean(
        string="Is Server Deleted",
        readonly=True,
    )
    # mapping field
    mt_currency_id = fields.Many2one(
        comodel_name='money_tracker.currency',
        string="Money Tracker Currency",
        readonly=True,
    )
    internal_currency_id = fields.Many2one(
        comodel_name="res.currency",
        related="mt_currency_id.currency_id",
        string="Internal Currency",
        store=True,
    )

    @api.model
    def get_mapping_fields(self):
        return {
            # fetch-field: model-field
            'server_id': 'accountServerID',
            'id': 'accountID',
            'user_id': 'userID',
            'currency_id': 'currencyID',
        }

    @api.model
    def sync_accounts(self):
        current_user = self.env.user
        current_user._check_api_token_empty()
        account_data, metadata = current_user.get_mt_accounts()
        # prepare mapping data
        mt_currency_data = self.env['money_tracker.currency'].search(
            domain=[
                ('owner_id', '=', current_user.id),
            ],
        ).grouped(key='code')
        # prepare mapping field
        mapping_fields = self.get_mapping_fields()
        for data in account_data:
            for fetch_field, model_field in mapping_fields.items():
                if fetch_field in data:
                    data[model_field] = data.pop(fetch_field)

            # mapping currencyID to real `money_tracker.currency`
            data['mt_currency_id'] = mt_currency_data.get(
                data.get('currency_code'),
                self.env['money_tracker.currency']
            ).id

        try:
            self.env['money_tracker.account'].search(domain=[
                ('owner_id', '=', current_user.id),
            ]).unlink()
            self.env[self._name].with_user(user=current_user).create(account_data)
        except Exception as e:
            _logger.exception(msg=e)
            raise ValidationError(e)
        finally:
            self.env['money_tracker.account'].flush_model()
            self.env['money_tracker.account'].flush_recordset()
