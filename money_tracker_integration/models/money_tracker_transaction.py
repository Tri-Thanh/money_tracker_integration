import logging

from odoo import models, fields, api, _
from odoo.exceptions import ValidationError
from odoo.osv import expression
from odoo.tools import Query, SQL, format_amount

from ..services.mt_parse_dt import MTParseDatetime

_logger = logging.getLogger(__name__)
_mt_parse_dt = MTParseDatetime()


class MoneyTrackerTransaction(models.Model):
    _name = "money_tracker.transaction"
    _inherit = [
        'money_tracker.mixin',
    ]
    _description = "Money Tracker Transaction"
    _rec_name = "remark"
    _order = "transaction_date desc, transaction_add_time desc"

    active = fields.Boolean(
        string="Active",
        default=True,
    )
    # owner fields
    owner_id = fields.Many2one(
        comodel_name="res.users",
        string="Owner",
        default=lambda self: self.env.user.id,
        index=True,
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
            ('4', "Account Balance Adjustment"),
            ('5', "AA Shared Expense"),
            ('6', "AA Settlement"),
        ],
        string="Type",
        index=True,
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
        index=True,
    )
    from_mt_account_currency_id = fields.Many2one(
        comodel_name='money_tracker.currency',
        string="MT Account Currency ID",
        related="from_mt_account_id.mt_currency_id",
    )
    from_currency_id = fields.Many2one(
        comodel_name="res.currency",
        string="Currency",
        related="from_mt_account_currency_id.currency_id",
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
        index=True,
        store=True,
        compute="_compute_transaction_date",
    )
    transaction_add_time = fields.Datetime(
        string="Add Time",
        store=True,
        compute="_compute_transaction_add_time",
    )

    def _read_group_select(self, aggregate_spec: str, query: Query):
        if aggregate_spec == 'amount:sum' and self.env.context.get('only_income_expense'):
            amount_sql = self._field_to_sql(
                alias=self._table,
                fname='amount',
                query=query,
            )
            type_sql = self._field_to_sql(
                alias=self._table,
                fname='type',
                query=query
            )
            return SQL(
                "SUM(CASE WHEN %s IN %s THEN %s ELSE 0 END)",
                type_sql,
                ('1', '2'),
                amount_sql
            )
        return super(MoneyTrackerTransaction, self)._read_group_select(aggregate_spec, query)

    @api.model
    def web_read_group(self, domain, fields, groupby, limit=None, offset=0, orderby=False, lazy=True):
        result = super(MoneyTrackerTransaction, self).web_read_group(
            domain,
            fields,
            groupby,
            limit=limit,
            offset=offset,
            orderby=orderby,
            lazy=lazy,
        )
        if not groupby or not any(field in ('amount', 'amount:sum') for field in fields):
            return result

        for group in result.get('groups', []):
            amount_by_type = dict(
                self._read_group(
                    group.get('__domain', []),
                    groupby=['type'],
                    aggregates=['amount:sum'],
                )
            )
            group['amount'] = {
                'value': group.get('amount') or 0.0,
                'income': amount_by_type.get('1', 0.0) or 0.0,
                'expense': amount_by_type.get('2', 0.0) or 0.0,
            }
        return result

    @api.model
    def _get_dashboard_amounts(self, domain=None):
        dashboard_domain = expression.AND([
            domain or [],
            [('type', 'in', ('1', '2'))],
        ])
        grouped_amounts = self._read_group(
            dashboard_domain,
            groupby=['type'],
            aggregates=['amount:sum'],
        )
        amount_by_type = {
            transaction_type: amount or 0.0
            for transaction_type, amount in grouped_amounts
        }
        expense_total = abs(amount_by_type.get('2', 0.0))
        income_total = amount_by_type.get('1', 0.0)
        return {
            'domain': dashboard_domain,
            'expense': expense_total,
            'income': income_total,
            'net_flow': income_total - expense_total,
        }

    def _format_signed_amount(self, amount, currency):
        formatted_amount = format_amount(self.env, amount, currency)
        return f"+{formatted_amount}" if amount > 0 else formatted_amount

    @api.model
    def _get_dashboard_delta_ratio(self, current_amount, previous_amount):
        if not previous_amount:
            return False
        return (current_amount - previous_amount) / abs(previous_amount)

    @api.model
    def _get_dashboard_currency(self, domain):
        query = self._where_calc(domain)
        self._apply_ir_rules(query, 'read')
        account_alias = SQL.identifier('mt_dashboard_account')
        account_currency_field = SQL.identifier('mt_dashboard_account', 'internal_currency_id')
        account_id_field = SQL.identifier('mt_dashboard_account', 'id')
        rows = self.env.execute_query(SQL(
            """
            SELECT DISTINCT %(account_currency_field)s
              FROM %(from_clause)s
              LEFT JOIN %(account_table)s AS %(account_alias)s
                ON %(account_id_field)s = %(transaction_account_field)s
             WHERE %(where_clause)s
               AND %(account_currency_field)s IS NOT NULL
             LIMIT 2
            """,
            account_alias=account_alias,
            account_currency_field=account_currency_field,
            account_id_field=account_id_field,
            account_table=SQL.identifier('money_tracker_account'),
            from_clause=query.from_clause,
            transaction_account_field=SQL.identifier(query.table, 'from_mt_account_id'),
            where_clause=query.where_clause or SQL("TRUE"),
        ))
        currency_ids = [currency_id for currency_id, in rows]
        if len(currency_ids) == 1:
            return self.env['res.currency'].browse(currency_ids[0])
        return self.env.company.currency_id

    @api.model
    def retrieve_dashboard(self, domain=None, previous_domain=None):
        self.browse().check_access('read')

        current_amounts = self._get_dashboard_amounts(domain)
        previous_amounts = (
            self._get_dashboard_amounts(previous_domain)
            if previous_domain is not None
            else None
        )
        currency = self._get_dashboard_currency(current_amounts['domain'])
        expense_income_ratio = False
        if current_amounts['income']:
            expense_income_ratio = current_amounts['expense'] / current_amounts['income']

        return {
            'expense_total': format_amount(self.env, current_amounts['expense'], currency),
            'income_total': format_amount(self.env, current_amounts['income'], currency),
            'net_flow_total': self._format_signed_amount(current_amounts['net_flow'], currency),
            'net_flow_amount': current_amounts['net_flow'],
            'expense_income_ratio': expense_income_ratio,
            'expense_delta_ratio': self._get_dashboard_delta_ratio(
                current_amounts['expense'],
                previous_amounts['expense'],
            ) if previous_amounts else False,
            'income_delta_ratio': self._get_dashboard_delta_ratio(
                current_amounts['income'],
                previous_amounts['income'],
            ) if previous_amounts else False,
        }

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
        mt_account_data = self.env['money_tracker.account'].search(
            domain=[
                ('owner_id', '=', self.env.user.id),
            ]
        ).grouped(key='accountID')

        for data in transactions_data:
            parsed = {}
            transaction_type = str(data.get('type', ''))
            if transaction_type not in ('1', '2', '3'):
                continue
            for api_key, api_value in data.items():
                if api_key in drop_fields:
                    continue
                model_field_name = mapping_fields.get(api_key, api_key)
                # mapping internal field
                if model_field_name == 'incomeExpenditureCategoryExternalID':
                    parsed['mt_category_id'] = mt_categoriy_data.get(api_value, self.env['money_tracker.category']).id
                if model_field_name == 'fromAccountExternalID':
                    parsed['from_mt_account_id'] = mt_account_data.get(api_value, self.env['money_tracker.account']).id
                elif model_field_name == 'toAccountExternalID':
                    parsed['to_mt_account_id'] = mt_account_data.get(api_value, self.env['money_tracker.account']).id
                # convert amount base type
                if model_field_name == 'amount' and transaction_type == '2':
                    api_value = -abs(float(api_value or '0.0'))
                parsed[model_field_name] = api_value
            yield parsed

    @api.model
    def sync_transactions(self, **kwargs):
        current_user = self.env.user
        current_user._check_api_token_empty()
        datas, meta = current_user.get_mt_transactions(**kwargs)
        if datas is None:
            raise ValidationError(_("Money Tracker returned invalid transaction data."))

        parsed_data = self.parse_mt_transaction_data(transactions_data=datas)
        try:
            self.env['money_tracker.transaction'].search(
                domain=[
                    ('owner_id', '=', current_user.id),
                ]
            ).write({
                'active': False,
            })

            self.env[self._name].with_user(user=current_user).create(parsed_data)
        except Exception as e:
            _logger.exception(msg=e)
            raise ValidationError(e)
        finally:
            self.env[self._name].flush_model()
            self.env[self._name].flush_recordset()

    @api.model
    def sync_data(self):
        self.sync_transactions()

    @api.model
    def action_open_mt_data(self):
        action = self.env['ir.actions.actions']._for_xml_id(
            full_xml_id='money_tracker_integration.money_tracker_transaction_action',
        )
        return action

    @api.depends('transactionDate')
    def _compute_transaction_date(self):
        mapping_fields = self.get_reverse_mapping_fields()
        for transaction in self:
            transaction.transaction_date = _mt_parse_dt.parse_mt_datetime(
                value=transaction.transactionDate,
                unit=self._get_mt_field_unit(
                    api_field_name=mapping_fields.get('transactionDate', ''),
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
                    api_field_name=mapping_fields.get('transactionAddTime', ''),
                ),
                output=self._fields.get('transaction_add_time'),
            )

    def _compute_display_name(self):
        # not set dependency field to avoid display_name not reload
        for transaction in self:
            if transaction.type in ('1', '2'):
                transaction.display_name = transaction.remark or transaction.mt_category_id.display_name
            elif transaction.type == '3':
                transaction.display_name = "{from_account} => {to_account}".format(
                    from_account="{} {}".format(
                        transaction.from_mt_account_id.name,
                        "({})".format(
                            transaction.from_mt_account_id.remark
                        ) if transaction.from_mt_account_id.remark else "",
                    ),
                    to_account="{} {}".format(
                        transaction.to_mt_account_id.name,
                        "({})".format(
                            transaction.to_mt_account_id.remark
                        ) if transaction.to_mt_account_id.remark else "",
                    ),
                )
            else:
                transaction.display_name = transaction[transaction._rec_name]
