# -*- coding: utf-8 -*-
{
    'name': "Money Tracker Integration",

    'summary': "An Integration Odoo for Money Tracker",

    'author': "L-Tr-Thanh (ltrthanh.dev@gmail.com)",
    'category': 'Uncategorized',
    'version': '18.0.0.0.0',
    'license': "LGPL-3",

    # any module necessary for this one to work correctly
    'depends': [
        'base',
        'web',
    ],

    # always loaded
    'data': [
        # data
        'data/ir_config_parameter.xml',
        'data/cron.xml',
        # security
        'security/ir.model.access.csv',
        'security/mt_currency_rules.xml',
        'security/mt_category_rules.xml',
        'security/mt_account_rules.xml',
        'security/mt_transaction_rules.xml',
        # views
        'views/res_users_views.xml',
        'views/money_tracker_currency_views.xml',
        'views/money_tracker_category_views.xml',
        'views/money_tracker_account_views.xml',
        'views/money_tracker_transaction_views.xml',

        # menu
        'views/menu.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'money_tracker_integration/static/src/views/list/mt_sync_data/*',
            'money_tracker_integration/static/src/views/widget/mt_display_remark/*',
            'money_tracker_integration/static/src/views/kanban/*',
            'money_tracker_integration/static/src/views/list/list_renderer.xml',
            'money_tracker_integration/static/src/views/list/list_renderer.js',
            'money_tracker_integration/static/src/views/list/list_renderer.scss',
        ],
    },
}
