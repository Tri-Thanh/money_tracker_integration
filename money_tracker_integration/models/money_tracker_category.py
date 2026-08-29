import logging

from odoo import models, fields, api
from odoo.exceptions import ValidationError

_logger = logging.getLogger(__name__)


class MoneyTrackerCategory(models.Model):
    _name = "money_tracker.category"
    _description = "Money Tracker Category"
    _rec_name = "title"

    categoryID = fields.Char(
        string="Category External ID",
        required=True,
    )
    title = fields.Char(
        string="Title",
        required=True,
    )
    type = fields.Selection(
        selection=[
            ('1', 'Income'),
            ('2', "Expense"),
        ],
        string="Type",
        required=True,
        default='2',
    )
    owner_id = fields.Many2one(
        comodel_name="res.users",
        string="Owner",
        required=True,
        default=lambda self: self.env.user.id,
    )

    _sql_constraints = [
        ('unique_categoryid_per_owner', 'UNIQUE(categoryID, owner_id)', "Category's ID must be unique"),
    ]

    @api.model
    def get_mapping_fields(self):
        # format:
        # {
        #   api_response_field: model_field
        # }
        return {
            'id': 'categoryID',
        }

    @api.model
    def sync_categories(self):
        current_user = self.env.user
        current_user._check_api_token_empty()
        categories_data, metadata = current_user.get_mt_categories()
        mapping_fields = self.get_mapping_fields()
        for data in categories_data:
            for fetch_field, model_field in mapping_fields.items():
                if fetch_field in data:
                    data[model_field] = data.pop(fetch_field)
        try:
            self.env['money_tracker.category'].search(domain=[]).unlink()
            self.env[self._name].with_user(user=current_user).create(categories_data)
        except Exception as e:
            _logger.exception(msg=e)
            raise ValidationError(e)
