from odoo import fields

from datetime import datetime, timezone, timedelta


class MTParseDatetime:
    DEFAULT_TIMEZONE = timezone(timedelta(hours=8))

    def __init__(self):
        pass

    @staticmethod
    def _epoch_to_utc(value, unit):
        if value in (None, False, ''):
            return False
        timestamp = int(value)

        if unit == 'milliseconds':
            timestamp /= 1000
        elif unit == 'seconds':
            pass
        else:
            raise ValueError(f"Unsupported epoch unit: {unit}")

        return datetime.fromtimestamp(timestamp)

    def parse_mt_datetime(self, value, unit='ms', output=fields.Datetime):
        dt_utc = self._epoch_to_utc(value=value, unit=unit)

        if not dt_utc:
            return False

        if isinstance(output, fields.Datetime):
            # Odoo fields.Datetime stores UTC naive datetime.
            return dt_utc.replace(tzinfo=None)

        if isinstance(output, fields.Date):
            # API date filter uses PRC / UTC+08:00 calendar boundaries.
            return dt_utc.astimezone(self.DEFAULT_TIMEZONE).date()

        raise ValueError(f"Unsupported output: {output}")
