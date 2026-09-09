import logging

from odoo import models, fields, api
from odoo.exceptions import ValidationError

from ..services.mt_parse_dt import MTParseDatetime

_logger = logging.getLogger(__name__)
_mt_parse_dt = MTParseDatetime()


class MoneyTrackerTransaction(models.Model):
    _name = "money_tracker.transaction"
    _description = "Money Tracker Transaction"
    _rec_name = "remark"

    # owner fields
    owner_id = fields.Many2one(
        comodel_name="res.users",
        string="Owner",
        default=lambda self: self.env.user.id,
        readonly=True,
    )
    # sync fields
    transactionServerID = fields.Char(
        string="Transactio Server ID",
        readonly=True,
    )
    transactionExternalID = fields.Char(
        string="Transactio External ID",
        readonly=True,
    )
    transactionUserID = fields.Char(
        string="Transaction User ID",
        readonly=True,
    )
    type = fields.Selection(
        selection=[
            ('1', 'Income'),
            ('2', "Expense"),
            ('3', "Transfer"),
        ],
        string="Type",
        required=True,
        readonly=True,
    )
    fromAccountExternalID = fields.Char(
        string="From Account External ID",
        readonly=True,
    )
    toAccountExternalID = fields.Char(
        string="To Account External ID",
        readonly=True,
    )
    incomeExpenditureCategoryExternalID = fields.Char(
        string="Income Expenditure Category External ID",
        readonly=True,
    )
    transactionDate = fields.Char(
        string="Transaction Date",
        readonly=True,
    )
    transactionYear = fields.Char(
        string="Transaction Year",
        readonly=True,
    )
    transactionMonth = fields.Char(
        string="Transaction Month",
        readonly=True,
    )
    transactionDay = fields.Char(
        string="Transaction Day",
        readonly=True,
    )
    amount = fields.Float(
        string="Amount",
        readonly=True,
    )
    remark = fields.Char(
        string="Remark",
        readonly=True,
    )
    transactionAddTime = fields.Char(
        string="Transaction Add Time",
        readonly=True,
    )
    # Money Tracker related fields
    from_mt_account_id = fields.Many2one(
        comodel_name='money_tracker.account',
        string="MT from Account ID",
    )
    from_mt_account_currency_id = fields.Many2one(
        comodel_name='money_tracker.currency',
        string="MT Account Currency ID",
        related="from_mt_account_id.mt_currency_id",
    )
    to_mt_account_id = fields.Many2one(
        comodel_name='money_tracker.account',
        string="MT To Account ID",
    )
    mt_category_id = fields.Many2one(
        comodel_name='money_tracker.category',
        string="MT Category",
    )
    # compute fields
    transaction_date = fields.Date(
        string="Date",
        store=True,
        compute="_compute_transaction_date",
    )
    transaction_add_time = fields.Datetime(
        string="Add Time",
        store=True,
        compute="_compute_transaction_add_time",
    )

    @api.model
    def _get_mt_field_unit(self, api_field_name=''):
        return {
            'date_time': 'milliseconds',
            'add_time': 'milliseconds',
            'update_time': 'milliseconds',
            'server_add_time': 'seconds',
            'server_update_time': 'seconds',
        }.get(api_field_name, 'unknown')

    @api.model
    def get_mapping_fields(self):
        return {
            # api-field: model-field
            'server_id': 'transactionServerID',
            'id': 'transactionExternalID',
            'user_id': 'transactionUserID',
            'from_account_id': 'fromAccountExternalID',
            'to_account_id': 'toAccountExternalID',
            'income_expenditure_category_id': 'incomeExpenditureCategoryExternalID',
            'year': 'transactionYear',
            'month': 'transactionMonth',
            'day': 'transactionDay',
            'date_time': 'transactionDate',
            'add_time': 'transactionAddTime',
        }

    @api.model
    def get_reverse_mapping_fields(self):
        mapping_fields = self.get_mapping_fields()
        return dict(zip(mapping_fields.values(), mapping_fields.keys()))

    @api.model
    def get_drop_fields(self):
        return [
            'user_id',
            'account_currency_id',
            'account_currency_amount',
            'foreign_currency_id',
            'foreign_currency_amount',
            'pictures',
            'update_time',
            'is_server_delete',
            'server_add_time',
            'server_update_time',
        ]

    @api.model
    def parse_mt_transaction_data(self, transactions_data: list):
        drop_fields = set(self.get_drop_fields())
        mapping_fields = self.get_mapping_fields()
        mt_categoriy_data = self.env['money_tracker.category'].search(
            domain=[
                ('owner_id', '=', self.env.user.id),
            ]
        ).grouped(key='categoryID')

        # drop or update model-fields
        for data in transactions_data:
            parsed = {}
            for api_key, api_value in data.items():
                if api_key in drop_fields:
                    continue
                model_field_name = mapping_fields.get(api_key, api_key)
                if model_field_name == 'incomeExpenditureCategoryExternalID':
                    print(mt_categoriy_data.get(api_value, self.env['money_tracker.category']))
                    parsed['mt_category_id'] = mt_categoriy_data.get(api_value, self.env['money_tracker.category']).id
                parsed[model_field_name] = api_value
            yield parsed

    @api.model
    def sync_transactions(self, **kwargs):
        current_user = self.env.user
        current_user._check_api_token_empty()
        datas, meta = current_user.get_mt_transactions(**kwargs)
        parsed_data = self.parse_mt_transaction_data(transactions_data=datas)

        try:
            self.env['money_tracker.transaction'].search(
                domain=[
                    ('owner_id', '=', current_user.id),
                ]
            ).unlink()

            self.env[self._name].with_user(user=current_user).create(parsed_data)
        except Exception as e:
            _logger.exception(msg=e)
            raise ValidationError(e)
        finally:
            self.env['money_tracker.account'].flush_model()
            self.env['money_tracker.account'].flush_recordset()

    @api.depends('transactionDate')
    def _compute_transaction_date(self):
        mapping_fields = self.get_reverse_mapping_fields()
        for transaction in self:
            transaction.transaction_date = _mt_parse_dt.parse_mt_datetime(
                value=transaction.transactionDate,
                unit=self._get_mt_field_unit(
                    api_field_name=mapping_fields.get('transactionDate'),
                ),
                output=self._fields.get('transaction_date'),
            )

    @api.depends('transactionAddTime')
    def _compute_transaction_add_time(self):
        mapping_fields = self.get_reverse_mapping_fields()
        for transaction in self:
            transaction.transaction_add_time = _mt_parse_dt.parse_mt_datetime(
                value=transaction.transactionAddTime,
                unit=self._get_mt_field_unit(
                    api_field_name=mapping_fields.get('transactionAddTime'),
                ),
                output=self._fields.get('transaction_add_time'),
            )

