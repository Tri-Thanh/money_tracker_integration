# -*- coding: utf-8 -*-
{
    'name': "Money Tracker Integration",

    'summary': "An Integration Odoo for Money Tracker",

    'author': "L-Tr-Thanh (ltrthanh.dev@gmail.com)",
    'category': 'Uncategorized',
    'version': '18.0.0.0.0',

    # any module necessary for this one to work correctly
    'depends': [
        'base',
        'web',
    ],

    # always loaded
    'data': [
        # data
        'data/ir_config_parameter.xml',
        # security
        'security/ir.model.access.csv',
        # views
        'views/res_users_views.xml',
        'views/money_tracker_currency_views.xml',
        'views/money_tracker_category_views.xml',
	'views/money_tracker_account_views.xml',

        # menu
        'views/menu.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'money_tracker_integration/static/src/views/**/*',
        ],
    },
}
