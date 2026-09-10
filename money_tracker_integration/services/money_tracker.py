import requests
from typing import Dict, Any, Optional

from odoo import fields
from odoo.exceptions import ValidationError


class MoneyTrackerService:
    FULL_SYNC_END_DATE = "9999-12-31"

    def __init__(self, env, token, timeout: int = 15):
        self.env = env
        self.token = token
        self.timeout = timeout

    def _request(self, endpoint: str, params: Optional[Dict[str, Any]] = None):
        base_url = self.env['ir.config_parameter'].sudo().get_param(
            key='money_tracker.base_url',
            default='https://money.quhou123.com/Api',
        )
        payload = {
            'token': self.token,
        }
        if params:
            payload.update(params)

        request_url = f"{base_url}/{endpoint}"

        request_header = {
            'Accept': "application/json",
        }
        response = requests.post(
            url=request_url,
            data=payload,
            headers=request_header,
            timeout=self.timeout,
        )
        response.raise_for_status()
        result = response.json()
        if result.get("status") != 1:
            raise RuntimeError(f"Money Tracker API Error: {result.get('msg', 'Unknown error')}")
        return result.get("data"), result.get("meta")

    def get_categories(self):
        return self._request(
            endpoint="getCategories",
        )

    def get_cash_book_categories(self):
        return self._request(
            endpoint="getCashbookCategories",
        )

    def get_currencies(self):
        return self._request(
            endpoint="getCurrencyList",
        )

    def get_transactions(self, **params):
        limit = int(params.get('limit', 500))
        offset = int(params.get('offset', 0))
        start_date = fields.Date.to_date(value=params.get('start_date'))
        end_date = fields.Date.to_date(value=params.get('end_date'))

        if start_date:
            max_end_date = fields.Date.add(start_date, days=365)
            if end_date and end_date < start_date:
                raise ValidationError("param `end_date` must be greater than `start_date`")
            if not end_date or end_date > max_end_date:
                end_date = max_end_date
            params['end_date'] = end_date
        else:
            params.setdefault('end_date', self.FULL_SYNC_END_DATE)

        transaction_data = []
        transaction_meta = {}
        while offset >= 0:
            _params = {
                **params,
                'limit': limit,
                'offset': offset,
            }
            data, meta = self._request(
                endpoint="getTransactions",
                params=_params,
            )
            if data and isinstance(data, list):
                transaction_data.extend(data)

            transaction_meta = meta or {}

            if transaction_meta.get('has_more', False):
                offset += int(transaction_meta.get('limit', limit))
            else:
                offset = -1

        return transaction_data, transaction_meta

    def get_accounts(self):
        return self._request(
            endpoint="getAccounts",
        )
