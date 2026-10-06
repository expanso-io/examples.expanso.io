import type { Stage } from '@site/src/components/DataPipelineExplorer/types';

export const encryptionPatternsStages: Stage[] = [
  {
    "id": 1,
    "slug": "original-sensitive-data",
    "title": "Original Sensitive Data",
    "description": "Synthetic payment and customer fields before the example applies field-level encryption patterns.",
    "inputLines": [
      {
        "content": "{",
        "indent": 0
      },
      {
        "content": "\"transaction_id\": \"txn-12345\",",
        "indent": 1
      },
      {
        "content": "\"payment\": {",
        "indent": 1
      },
      {
        "content": "\"card_number\": \"4532-1234-5678-9010\",",
        "indent": 2
      },
      {
        "content": "\"cvv\": \"123\",",
        "indent": 2
      },
      {
        "content": "\"cardholder_name\": \"Sarah Johnson\"",
        "indent": 2
      },
      {
        "content": "},",
        "indent": 1
      },
      {
        "content": "\"customer\": {",
        "indent": 1
      },
      {
        "content": "\"first_name\": \"Sarah\",",
        "indent": 2
      },
      {
        "content": "\"last_name\": \"Johnson\",",
        "indent": 2
      },
      {
        "content": "\"email\": \"sarah.johnson@example.com\",",
        "indent": 2
      },
      {
        "content": "\"phone\": \"+1-415-555-0123\",",
        "indent": 2
      },
      {
        "content": "\"ssn\": \"123-45-6789\",",
        "indent": 2
      },
      {
        "content": "\"date_of_birth\": \"1985-03-15\"",
        "indent": 2
      },
      {
        "content": "},",
        "indent": 1
      },
      {
        "content": "\"billing_address\": {",
        "indent": 1
      },
      {
        "content": "\"street\": \"123 Main St\",",
        "indent": 2
      },
      {
        "content": "\"zip\": \"94103\",",
        "indent": 2
      },
      {
        "content": "\"city\": \"San Francisco\",",
        "indent": 2
      },
      {
        "content": "\"state\": \"CA\",",
        "indent": 2
      },
      {
        "content": "\"country\": \"US\"",
        "indent": 2
      },
      {
        "content": "},",
        "indent": 1
      },
      {
        "content": "\"shipping_address\": {",
        "indent": 1
      },
      {
        "content": "\"street\": \"456 Market St\",",
        "indent": 2
      },
      {
        "content": "\"zip\": \"94105\",",
        "indent": 2
      },
      {
        "content": "\"city\": \"San Francisco\",",
        "indent": 2
      },
      {
        "content": "\"state\": \"CA\",",
        "indent": 2
      },
      {
        "content": "\"country\": \"US\"",
        "indent": 2
      },
      {
        "content": "}",
        "indent": 1
      },
      {
        "content": "}",
        "indent": 0
      }
    ],
    "outputLines": [
      {
        "content": "{",
        "indent": 0
      },
      {
        "content": "\"transaction_id\": \"txn-12345\",",
        "indent": 1
      },
      {
        "content": "\"payment\": {",
        "indent": 1
      },
      {
        "content": "\"card_number\": \"4532-1234-5678-9010\",",
        "indent": 2
      },
      {
        "content": "\"cvv\": \"123\",",
        "indent": 2
      },
      {
        "content": "\"cardholder_name\": \"Sarah Johnson\"",
        "indent": 2
      },
      {
        "content": "},",
        "indent": 1
      },
      {
        "content": "\"customer\": {",
        "indent": 1
      },
      {
        "content": "\"first_name\": \"Sarah\",",
        "indent": 2
      },
      {
        "content": "\"last_name\": \"Johnson\",",
        "indent": 2
      },
      {
        "content": "\"email\": \"sarah.johnson@example.com\",",
        "indent": 2
      },
      {
        "content": "\"phone\": \"+1-415-555-0123\",",
        "indent": 2
      },
      {
        "content": "\"ssn\": \"123-45-6789\",",
        "indent": 2
      },
      {
        "content": "\"date_of_birth\": \"1985-03-15\"",
        "indent": 2
      },
      {
        "content": "},",
        "indent": 1
      },
      {
        "content": "\"billing_address\": {",
        "indent": 1
      },
      {
        "content": "\"street\": \"123 Main St\",",
        "indent": 2
      },
      {
        "content": "\"zip\": \"94103\",",
        "indent": 2
      },
      {
        "content": "\"city\": \"San Francisco\",",
        "indent": 2
      },
      {
        "content": "\"state\": \"CA\",",
        "indent": 2
      },
      {
        "content": "\"country\": \"US\"",
        "indent": 2
      },
      {
        "content": "},",
        "indent": 1
      },
      {
        "content": "\"shipping_address\": {",
        "indent": 1
      },
      {
        "content": "\"street\": \"456 Market St\",",
        "indent": 2
      },
      {
        "content": "\"zip\": \"94105\",",
        "indent": 2
      },
      {
        "content": "\"city\": \"San Francisco\",",
        "indent": 2
      },
      {
        "content": "\"state\": \"CA\",",
        "indent": 2
      },
      {
        "content": "\"country\": \"US\"",
        "indent": 2
      },
      {
        "content": "}",
        "indent": 1
      },
      {
        "content": "}",
        "indent": 0
      }
    ]
  },
  {
    "id": 2,
    "slug": "payment-field-encryption",
    "title": "Payment Field Encryption",
    "description": "Encrypt payment fields with CARD_ENCRYPTION_KEY_HEX, retain nonces and reviewed derivatives, and delete CVV.",
    "inputLines": [
      {
        "content": "{",
        "indent": 0
      },
      {
        "content": "\"transaction_id\": \"txn-12345\",",
        "indent": 1
      },
      {
        "content": "\"payment\": {",
        "indent": 1
      },
      {
        "content": "\"card_number\": \"4532-1234-5678-9010\",",
        "indent": 2
      },
      {
        "content": "\"cvv\": \"123\",",
        "indent": 2
      },
      {
        "content": "\"cardholder_name\": \"Sarah Johnson\"",
        "indent": 2
      },
      {
        "content": "},",
        "indent": 1
      },
      {
        "content": "\"customer\": {",
        "indent": 1
      },
      {
        "content": "\"first_name\": \"Sarah\",",
        "indent": 2
      },
      {
        "content": "\"last_name\": \"Johnson\",",
        "indent": 2
      },
      {
        "content": "\"email\": \"sarah.johnson@example.com\",",
        "indent": 2
      },
      {
        "content": "\"phone\": \"+1-415-555-0123\",",
        "indent": 2
      },
      {
        "content": "\"ssn\": \"123-45-6789\",",
        "indent": 2
      },
      {
        "content": "\"date_of_birth\": \"1985-03-15\"",
        "indent": 2
      },
      {
        "content": "},",
        "indent": 1
      },
      {
        "content": "\"billing_address\": {",
        "indent": 1
      },
      {
        "content": "\"street\": \"123 Main St\",",
        "indent": 2
      },
      {
        "content": "\"zip\": \"94103\",",
        "indent": 2
      },
      {
        "content": "\"city\": \"San Francisco\",",
        "indent": 2
      },
      {
        "content": "\"state\": \"CA\",",
        "indent": 2
      },
      {
        "content": "\"country\": \"US\"",
        "indent": 2
      },
      {
        "content": "},",
        "indent": 1
      },
      {
        "content": "\"shipping_address\": {",
        "indent": 1
      },
      {
        "content": "\"street\": \"456 Market St\",",
        "indent": 2
      },
      {
        "content": "\"zip\": \"94105\",",
        "indent": 2
      },
      {
        "content": "\"city\": \"San Francisco\",",
        "indent": 2
      },
      {
        "content": "\"state\": \"CA\",",
        "indent": 2
      },
      {
        "content": "\"country\": \"US\"",
        "indent": 2
      },
      {
        "content": "}",
        "indent": 1
      },
      {
        "content": "}",
        "indent": 0
      }
    ],
    "outputLines": [
      {
        "content": "{",
        "indent": 0
      },
      {
        "content": "\"transaction_id\": \"txn-12345\",",
        "indent": 1
      },
      {
        "content": "\"payment\": {",
        "indent": 1
      },
      {
        "content": "\"card_last_four\": \"9010\",",
        "indent": 2
      },
      {
        "content": "\"card_bin\": \"453212\",",
        "indent": 2
      },
      {
        "content": "\"card_brand\": \"visa\",",
        "indent": 2
      },
      {
        "content": "\"card_number_encrypted\": \"lpCo/ZX8nEv4v3QMZp7j7DXPHZHZgdSisDEbapgMAYu6QJU=\",",
        "indent": 2
      },
      {
        "content": "\"card_number_nonce\": \"52860578201ae859fc217382\",",
        "indent": 2
      },
      {
        "content": "\"cardholder_name_encrypted\": \"FQY/TPv7A9USu5VN9OMdxTXSJ7a3w+Y1HV8lHj0=\",",
        "indent": 2
      },
      {
        "content": "\"cardholder_name_nonce\": \"d4bd8726adf662873155fa49\"",
        "indent": 2
      },
      {
        "content": "},",
        "indent": 1
      },
      {
        "content": "\"customer\": {",
        "indent": 1
      },
      {
        "content": "\"first_name\": \"Sarah\",",
        "indent": 2
      },
      {
        "content": "\"last_name\": \"Johnson\",",
        "indent": 2
      },
      {
        "content": "\"email\": \"sarah.johnson@example.com\",",
        "indent": 2
      },
      {
        "content": "\"phone\": \"+1-415-555-0123\",",
        "indent": 2
      },
      {
        "content": "\"ssn\": \"123-45-6789\",",
        "indent": 2
      },
      {
        "content": "\"date_of_birth\": \"1985-03-15\"",
        "indent": 2
      },
      {
        "content": "},",
        "indent": 1
      },
      {
        "content": "\"billing_address\": {",
        "indent": 1
      },
      {
        "content": "\"street\": \"123 Main St\",",
        "indent": 2
      },
      {
        "content": "\"zip\": \"94103\",",
        "indent": 2
      },
      {
        "content": "\"city\": \"San Francisco\",",
        "indent": 2
      },
      {
        "content": "\"state\": \"CA\",",
        "indent": 2
      },
      {
        "content": "\"country\": \"US\"",
        "indent": 2
      },
      {
        "content": "},",
        "indent": 1
      },
      {
        "content": "\"shipping_address\": {",
        "indent": 1
      },
      {
        "content": "\"street\": \"456 Market St\",",
        "indent": 2
      },
      {
        "content": "\"zip\": \"94105\",",
        "indent": 2
      },
      {
        "content": "\"city\": \"San Francisco\",",
        "indent": 2
      },
      {
        "content": "\"state\": \"CA\",",
        "indent": 2
      },
      {
        "content": "\"country\": \"US\"",
        "indent": 2
      },
      {
        "content": "}",
        "indent": 1
      },
      {
        "content": "}",
        "indent": 0
      }
    ]
  },
  {
    "id": 3,
    "slug": "identity-field-encryption",
    "title": "Identity Field Encryption",
    "description": "Select synthetic identity fields for encryption and retain authored derived fields.",
    "inputLines": [
      {
        "content": "{",
        "indent": 0
      },
      {
        "content": "\"transaction_id\": \"txn-12345\",",
        "indent": 1
      },
      {
        "content": "\"payment\": {",
        "indent": 1
      },
      {
        "content": "\"card_last_four\": \"9010\",",
        "indent": 2
      },
      {
        "content": "\"card_bin\": \"453212\",",
        "indent": 2
      },
      {
        "content": "\"card_brand\": \"visa\",",
        "indent": 2
      },
      {
        "content": "\"card_number_encrypted\": \"lpCo/ZX8nEv4v3QMZp7j7DXPHZHZgdSisDEbapgMAYu6QJU=\",",
        "indent": 2
      },
      {
        "content": "\"card_number_nonce\": \"52860578201ae859fc217382\",",
        "indent": 2
      },
      {
        "content": "\"cardholder_name_encrypted\": \"FQY/TPv7A9USu5VN9OMdxTXSJ7a3w+Y1HV8lHj0=\",",
        "indent": 2
      },
      {
        "content": "\"cardholder_name_nonce\": \"d4bd8726adf662873155fa49\"",
        "indent": 2
      },
      {
        "content": "},",
        "indent": 1
      },
      {
        "content": "\"customer\": {",
        "indent": 1
      },
      {
        "content": "\"first_name\": \"Sarah\",",
        "indent": 2
      },
      {
        "content": "\"last_name\": \"Johnson\",",
        "indent": 2
      },
      {
        "content": "\"email\": \"sarah.johnson@example.com\",",
        "indent": 2
      },
      {
        "content": "\"phone\": \"+1-415-555-0123\",",
        "indent": 2
      },
      {
        "content": "\"ssn\": \"123-45-6789\",",
        "indent": 2
      },
      {
        "content": "\"date_of_birth\": \"1985-03-15\"",
        "indent": 2
      },
      {
        "content": "},",
        "indent": 1
      },
      {
        "content": "\"billing_address\": {",
        "indent": 1
      },
      {
        "content": "\"street\": \"123 Main St\",",
        "indent": 2
      },
      {
        "content": "\"zip\": \"94103\",",
        "indent": 2
      },
      {
        "content": "\"city\": \"San Francisco\",",
        "indent": 2
      },
      {
        "content": "\"state\": \"CA\",",
        "indent": 2
      },
      {
        "content": "\"country\": \"US\"",
        "indent": 2
      },
      {
        "content": "},",
        "indent": 1
      },
      {
        "content": "\"shipping_address\": {",
        "indent": 1
      },
      {
        "content": "\"street\": \"456 Market St\",",
        "indent": 2
      },
      {
        "content": "\"zip\": \"94105\",",
        "indent": 2
      },
      {
        "content": "\"city\": \"San Francisco\",",
        "indent": 2
      },
      {
        "content": "\"state\": \"CA\",",
        "indent": 2
      },
      {
        "content": "\"country\": \"US\"",
        "indent": 2
      },
      {
        "content": "}",
        "indent": 1
      },
      {
        "content": "}",
        "indent": 0
      }
    ],
    "outputLines": [
      {
        "content": "{",
        "indent": 0
      },
      {
        "content": "\"transaction_id\": \"txn-12345\",",
        "indent": 1
      },
      {
        "content": "\"payment\": {",
        "indent": 1
      },
      {
        "content": "\"card_last_four\": \"9010\",",
        "indent": 2
      },
      {
        "content": "\"card_bin\": \"453212\",",
        "indent": 2
      },
      {
        "content": "\"card_brand\": \"visa\",",
        "indent": 2
      },
      {
        "content": "\"card_number_encrypted\": \"lpCo/ZX8nEv4v3QMZp7j7DXPHZHZgdSisDEbapgMAYu6QJU=\",",
        "indent": 2
      },
      {
        "content": "\"card_number_nonce\": \"52860578201ae859fc217382\",",
        "indent": 2
      },
      {
        "content": "\"cardholder_name_encrypted\": \"FQY/TPv7A9USu5VN9OMdxTXSJ7a3w+Y1HV8lHj0=\",",
        "indent": 2
      },
      {
        "content": "\"cardholder_name_nonce\": \"d4bd8726adf662873155fa49\"",
        "indent": 2
      },
      {
        "content": "},",
        "indent": 1
      },
      {
        "content": "\"customer\": {",
        "indent": 1
      },
      {
        "content": "\"date_of_birth\": \"1985-03-15\",",
        "indent": 2
      },
      {
        "content": "\"email_domain\": \"example.com\",",
        "indent": 2
      },
      {
        "content": "\"email_domain_type\": \"business\",",
        "indent": 2
      },
      {
        "content": "\"phone_country_code\": \"+1\",",
        "indent": 2
      },
      {
        "content": "\"phone_area_code\": \"415\",",
        "indent": 2
      },
      {
        "content": "\"ssn_last_four\": \"6789\",",
        "indent": 2
      },
      {
        "content": "\"email_encrypted\": \"kYxzQn3uiaoSRP2T7e1OUoHoLAoAl4jhO12cTAFr1XhdZLlnl1bJu78=\",",
        "indent": 2
      },
      {
        "content": "\"email_nonce\": \"b228b001aaf1433bfec2db4f\",",
        "indent": 2
      },
      {
        "content": "\"phone_encrypted\": \"FHavKi6h3xhC/Y/i7McfcU5mkiSgToR8hi5vQ99QBg==\",",
        "indent": 2
      },
      {
        "content": "\"phone_nonce\": \"ffa3a72cd946d9ec90ce902a\",",
        "indent": 2
      },
      {
        "content": "\"ssn_encrypted\": \"mHk4hhUSNKyrm+8uqc5zUKfgzSK0ldV3Nu9b\",",
        "indent": 2
      },
      {
        "content": "\"ssn_nonce\": \"de7c2ff8f51df67359fd7292\",",
        "indent": 2
      },
      {
        "content": "\"first_name_encrypted\": \"8bTSBScy5lspVQFfmhMTkTFE/jiw\",",
        "indent": 2
      },
      {
        "content": "\"first_name_nonce\": \"19784ba1a795818123adfa51\",",
        "indent": 2
      },
      {
        "content": "\"last_name_encrypted\": \"oYaSRzeYtC8YFd3ri+xuXgRtf1qeQ2Y=\",",
        "indent": 2
      },
      {
        "content": "\"last_name_nonce\": \"37a238b880b3e7f263499b28\"",
        "indent": 2
      },
      {
        "content": "},",
        "indent": 1
      },
      {
        "content": "\"billing_address\": {",
        "indent": 1
      },
      {
        "content": "\"street\": \"123 Main St\",",
        "indent": 2
      },
      {
        "content": "\"zip\": \"94103\",",
        "indent": 2
      },
      {
        "content": "\"city\": \"San Francisco\",",
        "indent": 2
      },
      {
        "content": "\"state\": \"CA\",",
        "indent": 2
      },
      {
        "content": "\"country\": \"US\"",
        "indent": 2
      },
      {
        "content": "},",
        "indent": 1
      },
      {
        "content": "\"shipping_address\": {",
        "indent": 1
      },
      {
        "content": "\"street\": \"456 Market St\",",
        "indent": 2
      },
      {
        "content": "\"zip\": \"94105\",",
        "indent": 2
      },
      {
        "content": "\"city\": \"San Francisco\",",
        "indent": 2
      },
      {
        "content": "\"state\": \"CA\",",
        "indent": 2
      },
      {
        "content": "\"country\": \"US\"",
        "indent": 2
      },
      {
        "content": "}",
        "indent": 1
      },
      {
        "content": "}",
        "indent": 0
      }
    ]
  },
  {
    "id": 4,
    "slug": "address-data-encryption-location-privacy",
    "title": "Address Data Encryption (Location Privacy)",
    "description": "Encrypt street addresses and detailed ZIP codes while preserving city, state, and ZIP prefix for demographic analytics.",
    "inputLines": [
      {
        "content": "{",
        "indent": 0
      },
      {
        "content": "\"transaction_id\": \"txn-12345\",",
        "indent": 1
      },
      {
        "content": "\"payment\": {",
        "indent": 1
      },
      {
        "content": "\"card_last_four\": \"9010\",",
        "indent": 2
      },
      {
        "content": "\"card_bin\": \"453212\",",
        "indent": 2
      },
      {
        "content": "\"card_brand\": \"visa\",",
        "indent": 2
      },
      {
        "content": "\"card_number_encrypted\": \"lpCo/ZX8nEv4v3QMZp7j7DXPHZHZgdSisDEbapgMAYu6QJU=\",",
        "indent": 2
      },
      {
        "content": "\"card_number_nonce\": \"52860578201ae859fc217382\",",
        "indent": 2
      },
      {
        "content": "\"cardholder_name_encrypted\": \"FQY/TPv7A9USu5VN9OMdxTXSJ7a3w+Y1HV8lHj0=\",",
        "indent": 2
      },
      {
        "content": "\"cardholder_name_nonce\": \"d4bd8726adf662873155fa49\"",
        "indent": 2
      },
      {
        "content": "},",
        "indent": 1
      },
      {
        "content": "\"customer\": {",
        "indent": 1
      },
      {
        "content": "\"date_of_birth\": \"1985-03-15\",",
        "indent": 2
      },
      {
        "content": "\"email_domain\": \"example.com\",",
        "indent": 2
      },
      {
        "content": "\"email_domain_type\": \"business\",",
        "indent": 2
      },
      {
        "content": "\"phone_country_code\": \"+1\",",
        "indent": 2
      },
      {
        "content": "\"phone_area_code\": \"415\",",
        "indent": 2
      },
      {
        "content": "\"ssn_last_four\": \"6789\",",
        "indent": 2
      },
      {
        "content": "\"email_encrypted\": \"kYxzQn3uiaoSRP2T7e1OUoHoLAoAl4jhO12cTAFr1XhdZLlnl1bJu78=\",",
        "indent": 2
      },
      {
        "content": "\"email_nonce\": \"b228b001aaf1433bfec2db4f\",",
        "indent": 2
      },
      {
        "content": "\"phone_encrypted\": \"FHavKi6h3xhC/Y/i7McfcU5mkiSgToR8hi5vQ99QBg==\",",
        "indent": 2
      },
      {
        "content": "\"phone_nonce\": \"ffa3a72cd946d9ec90ce902a\",",
        "indent": 2
      },
      {
        "content": "\"ssn_encrypted\": \"mHk4hhUSNKyrm+8uqc5zUKfgzSK0ldV3Nu9b\",",
        "indent": 2
      },
      {
        "content": "\"ssn_nonce\": \"de7c2ff8f51df67359fd7292\",",
        "indent": 2
      },
      {
        "content": "\"first_name_encrypted\": \"8bTSBScy5lspVQFfmhMTkTFE/jiw\",",
        "indent": 2
      },
      {
        "content": "\"first_name_nonce\": \"19784ba1a795818123adfa51\",",
        "indent": 2
      },
      {
        "content": "\"last_name_encrypted\": \"oYaSRzeYtC8YFd3ri+xuXgRtf1qeQ2Y=\",",
        "indent": 2
      },
      {
        "content": "\"last_name_nonce\": \"37a238b880b3e7f263499b28\"",
        "indent": 2
      },
      {
        "content": "},",
        "indent": 1
      },
      {
        "content": "\"billing_address\": {",
        "indent": 1
      },
      {
        "content": "\"street\": \"123 Main St\",",
        "indent": 2
      },
      {
        "content": "\"zip\": \"94103\",",
        "indent": 2
      },
      {
        "content": "\"city\": \"San Francisco\",",
        "indent": 2
      },
      {
        "content": "\"state\": \"CA\",",
        "indent": 2
      },
      {
        "content": "\"country\": \"US\"",
        "indent": 2
      },
      {
        "content": "},",
        "indent": 1
      },
      {
        "content": "\"shipping_address\": {",
        "indent": 1
      },
      {
        "content": "\"street\": \"456 Market St\",",
        "indent": 2
      },
      {
        "content": "\"zip\": \"94105\",",
        "indent": 2
      },
      {
        "content": "\"city\": \"San Francisco\",",
        "indent": 2
      },
      {
        "content": "\"state\": \"CA\",",
        "indent": 2
      },
      {
        "content": "\"country\": \"US\"",
        "indent": 2
      },
      {
        "content": "}",
        "indent": 1
      },
      {
        "content": "}",
        "indent": 0
      }
    ],
    "outputLines": [
      {
        "content": "{",
        "indent": 0
      },
      {
        "content": "\"transaction_id\": \"txn-12345\",",
        "indent": 1
      },
      {
        "content": "\"payment\": {",
        "indent": 1
      },
      {
        "content": "\"card_last_four\": \"9010\",",
        "indent": 2
      },
      {
        "content": "\"card_bin\": \"453212\",",
        "indent": 2
      },
      {
        "content": "\"card_brand\": \"visa\",",
        "indent": 2
      },
      {
        "content": "\"card_number_encrypted\": \"lpCo/ZX8nEv4v3QMZp7j7DXPHZHZgdSisDEbapgMAYu6QJU=\",",
        "indent": 2
      },
      {
        "content": "\"card_number_nonce\": \"52860578201ae859fc217382\",",
        "indent": 2
      },
      {
        "content": "\"cardholder_name_encrypted\": \"FQY/TPv7A9USu5VN9OMdxTXSJ7a3w+Y1HV8lHj0=\",",
        "indent": 2
      },
      {
        "content": "\"cardholder_name_nonce\": \"d4bd8726adf662873155fa49\"",
        "indent": 2
      },
      {
        "content": "},",
        "indent": 1
      },
      {
        "content": "\"customer\": {",
        "indent": 1
      },
      {
        "content": "\"date_of_birth\": \"1985-03-15\",",
        "indent": 2
      },
      {
        "content": "\"email_domain\": \"example.com\",",
        "indent": 2
      },
      {
        "content": "\"email_domain_type\": \"business\",",
        "indent": 2
      },
      {
        "content": "\"phone_country_code\": \"+1\",",
        "indent": 2
      },
      {
        "content": "\"phone_area_code\": \"415\",",
        "indent": 2
      },
      {
        "content": "\"ssn_last_four\": \"6789\",",
        "indent": 2
      },
      {
        "content": "\"email_encrypted\": \"kYxzQn3uiaoSRP2T7e1OUoHoLAoAl4jhO12cTAFr1XhdZLlnl1bJu78=\",",
        "indent": 2
      },
      {
        "content": "\"email_nonce\": \"b228b001aaf1433bfec2db4f\",",
        "indent": 2
      },
      {
        "content": "\"phone_encrypted\": \"FHavKi6h3xhC/Y/i7McfcU5mkiSgToR8hi5vQ99QBg==\",",
        "indent": 2
      },
      {
        "content": "\"phone_nonce\": \"ffa3a72cd946d9ec90ce902a\",",
        "indent": 2
      },
      {
        "content": "\"ssn_encrypted\": \"mHk4hhUSNKyrm+8uqc5zUKfgzSK0ldV3Nu9b\",",
        "indent": 2
      },
      {
        "content": "\"ssn_nonce\": \"de7c2ff8f51df67359fd7292\",",
        "indent": 2
      },
      {
        "content": "\"first_name_encrypted\": \"8bTSBScy5lspVQFfmhMTkTFE/jiw\",",
        "indent": 2
      },
      {
        "content": "\"first_name_nonce\": \"19784ba1a795818123adfa51\",",
        "indent": 2
      },
      {
        "content": "\"last_name_encrypted\": \"oYaSRzeYtC8YFd3ri+xuXgRtf1qeQ2Y=\",",
        "indent": 2
      },
      {
        "content": "\"last_name_nonce\": \"37a238b880b3e7f263499b28\"",
        "indent": 2
      },
      {
        "content": "},",
        "indent": 1
      },
      {
        "content": "\"billing_address\": {",
        "indent": 1
      },
      {
        "content": "\"city\": \"San Francisco\",",
        "indent": 2
      },
      {
        "content": "\"state\": \"CA\",",
        "indent": 2
      },
      {
        "content": "\"country\": \"US\",",
        "indent": 2
      },
      {
        "content": "\"zip_prefix\": \"941\",",
        "indent": 2
      },
      {
        "content": "\"metro_area\": \"sf_bay_area\",",
        "indent": 2
      },
      {
        "content": "\"street_encrypted\": \"kraUixfb9IRW1rTsdspmNM3hV2UCKNSWt1XC\",",
        "indent": 2
      },
      {
        "content": "\"street_nonce\": \"c3af7140b21eaae7d4be1b74\",",
        "indent": 2
      },
      {
        "content": "\"zip_encrypted\": \"9Y0HgXjL+O0/0OylXvpSGGi2nJW9\",",
        "indent": 2
      },
      {
        "content": "\"zip_nonce\": \"cec741b3ae70c6947a7bc394\"",
        "indent": 2
      },
      {
        "content": "},",
        "indent": 1
      },
      {
        "content": "\"shipping_address\": {",
        "indent": 1
      },
      {
        "content": "\"city\": \"San Francisco\",",
        "indent": 2
      },
      {
        "content": "\"state\": \"CA\",",
        "indent": 2
      },
      {
        "content": "\"country\": \"US\",",
        "indent": 2
      },
      {
        "content": "\"zip_prefix\": \"941\",",
        "indent": 2
      },
      {
        "content": "\"metro_area\": \"sf_bay_area\",",
        "indent": 2
      },
      {
        "content": "\"street_encrypted\": \"gsbAXd85EiIAjTx0Rw8cAkLNaR3XzWKDK1+4rwU=\",",
        "indent": 2
      },
      {
        "content": "\"street_nonce\": \"3da6fd3bc65870e32ffa7c3b\",",
        "indent": 2
      },
      {
        "content": "\"zip_encrypted\": \"zYQDTJo0l8kZPdZxrBBbpJaPVybJ\",",
        "indent": 2
      },
      {
        "content": "\"zip_nonce\": \"dd996a2c2be914f93905a46d\"",
        "indent": 2
      },
      {
        "content": "},",
        "indent": 1
      },
      {
        "content": "\"address_analysis\": {",
        "indent": 1
      },
      {
        "content": "\"same_city\": true,",
        "indent": 2
      },
      {
        "content": "\"same_state\": true,",
        "indent": 2
      },
      {
        "content": "\"same_metro\": true",
        "indent": 2
      },
      {
        "content": "}",
        "indent": 1
      },
      {
        "content": "}",
        "indent": 0
      }
    ]
  },
  {
    "id": 5,
    "slug": "temporal-field-encryption",
    "title": "Temporal Field Encryption",
    "description": "Encrypt selected source dates while retaining authored cohort and season fields for inspection.",
    "inputLines": [
      {
        "content": "{",
        "indent": 0
      },
      {
        "content": "\"transaction_id\": \"txn-12345\",",
        "indent": 1
      },
      {
        "content": "\"payment\": {",
        "indent": 1
      },
      {
        "content": "\"card_last_four\": \"9010\",",
        "indent": 2
      },
      {
        "content": "\"card_bin\": \"453212\",",
        "indent": 2
      },
      {
        "content": "\"card_brand\": \"visa\",",
        "indent": 2
      },
      {
        "content": "\"card_number_encrypted\": \"lpCo/ZX8nEv4v3QMZp7j7DXPHZHZgdSisDEbapgMAYu6QJU=\",",
        "indent": 2
      },
      {
        "content": "\"card_number_nonce\": \"52860578201ae859fc217382\",",
        "indent": 2
      },
      {
        "content": "\"cardholder_name_encrypted\": \"FQY/TPv7A9USu5VN9OMdxTXSJ7a3w+Y1HV8lHj0=\",",
        "indent": 2
      },
      {
        "content": "\"cardholder_name_nonce\": \"d4bd8726adf662873155fa49\"",
        "indent": 2
      },
      {
        "content": "},",
        "indent": 1
      },
      {
        "content": "\"customer\": {",
        "indent": 1
      },
      {
        "content": "\"date_of_birth\": \"1985-03-15\",",
        "indent": 2
      },
      {
        "content": "\"email_domain\": \"example.com\",",
        "indent": 2
      },
      {
        "content": "\"email_domain_type\": \"business\",",
        "indent": 2
      },
      {
        "content": "\"phone_country_code\": \"+1\",",
        "indent": 2
      },
      {
        "content": "\"phone_area_code\": \"415\",",
        "indent": 2
      },
      {
        "content": "\"ssn_last_four\": \"6789\",",
        "indent": 2
      },
      {
        "content": "\"email_encrypted\": \"kYxzQn3uiaoSRP2T7e1OUoHoLAoAl4jhO12cTAFr1XhdZLlnl1bJu78=\",",
        "indent": 2
      },
      {
        "content": "\"email_nonce\": \"b228b001aaf1433bfec2db4f\",",
        "indent": 2
      },
      {
        "content": "\"phone_encrypted\": \"FHavKi6h3xhC/Y/i7McfcU5mkiSgToR8hi5vQ99QBg==\",",
        "indent": 2
      },
      {
        "content": "\"phone_nonce\": \"ffa3a72cd946d9ec90ce902a\",",
        "indent": 2
      },
      {
        "content": "\"ssn_encrypted\": \"mHk4hhUSNKyrm+8uqc5zUKfgzSK0ldV3Nu9b\",",
        "indent": 2
      },
      {
        "content": "\"ssn_nonce\": \"de7c2ff8f51df67359fd7292\",",
        "indent": 2
      },
      {
        "content": "\"first_name_encrypted\": \"8bTSBScy5lspVQFfmhMTkTFE/jiw\",",
        "indent": 2
      },
      {
        "content": "\"first_name_nonce\": \"19784ba1a795818123adfa51\",",
        "indent": 2
      },
      {
        "content": "\"last_name_encrypted\": \"oYaSRzeYtC8YFd3ri+xuXgRtf1qeQ2Y=\",",
        "indent": 2
      },
      {
        "content": "\"last_name_nonce\": \"37a238b880b3e7f263499b28\"",
        "indent": 2
      },
      {
        "content": "},",
        "indent": 1
      },
      {
        "content": "\"billing_address\": {",
        "indent": 1
      },
      {
        "content": "\"city\": \"San Francisco\",",
        "indent": 2
      },
      {
        "content": "\"state\": \"CA\",",
        "indent": 2
      },
      {
        "content": "\"country\": \"US\",",
        "indent": 2
      },
      {
        "content": "\"zip_prefix\": \"941\",",
        "indent": 2
      },
      {
        "content": "\"metro_area\": \"sf_bay_area\",",
        "indent": 2
      },
      {
        "content": "\"street_encrypted\": \"kraUixfb9IRW1rTsdspmNM3hV2UCKNSWt1XC\",",
        "indent": 2
      },
      {
        "content": "\"street_nonce\": \"c3af7140b21eaae7d4be1b74\",",
        "indent": 2
      },
      {
        "content": "\"zip_encrypted\": \"9Y0HgXjL+O0/0OylXvpSGGi2nJW9\",",
        "indent": 2
      },
      {
        "content": "\"zip_nonce\": \"cec741b3ae70c6947a7bc394\"",
        "indent": 2
      },
      {
        "content": "},",
        "indent": 1
      },
      {
        "content": "\"shipping_address\": {",
        "indent": 1
      },
      {
        "content": "\"city\": \"San Francisco\",",
        "indent": 2
      },
      {
        "content": "\"state\": \"CA\",",
        "indent": 2
      },
      {
        "content": "\"country\": \"US\",",
        "indent": 2
      },
      {
        "content": "\"zip_prefix\": \"941\",",
        "indent": 2
      },
      {
        "content": "\"metro_area\": \"sf_bay_area\",",
        "indent": 2
      },
      {
        "content": "\"street_encrypted\": \"gsbAXd85EiIAjTx0Rw8cAkLNaR3XzWKDK1+4rwU=\",",
        "indent": 2
      },
      {
        "content": "\"street_nonce\": \"3da6fd3bc65870e32ffa7c3b\",",
        "indent": 2
      },
      {
        "content": "\"zip_encrypted\": \"zYQDTJo0l8kZPdZxrBBbpJaPVybJ\",",
        "indent": 2
      },
      {
        "content": "\"zip_nonce\": \"dd996a2c2be914f93905a46d\"",
        "indent": 2
      },
      {
        "content": "},",
        "indent": 1
      },
      {
        "content": "\"address_analysis\": {",
        "indent": 1
      },
      {
        "content": "\"same_city\": true,",
        "indent": 2
      },
      {
        "content": "\"same_state\": true,",
        "indent": 2
      },
      {
        "content": "\"same_metro\": true",
        "indent": 2
      },
      {
        "content": "}",
        "indent": 1
      },
      {
        "content": "}",
        "indent": 0
      }
    ],
    "outputLines": [
      {
        "content": "{",
        "indent": 0
      },
      {
        "content": "\"transaction_id\": \"txn-12345\",",
        "indent": 1
      },
      {
        "content": "\"payment\": {",
        "indent": 1
      },
      {
        "content": "\"card_last_four\": \"9010\",",
        "indent": 2
      },
      {
        "content": "\"card_bin\": \"453212\",",
        "indent": 2
      },
      {
        "content": "\"card_brand\": \"visa\",",
        "indent": 2
      },
      {
        "content": "\"card_number_encrypted\": \"lpCo/ZX8nEv4v3QMZp7j7DXPHZHZgdSisDEbapgMAYu6QJU=\",",
        "indent": 2
      },
      {
        "content": "\"card_number_nonce\": \"52860578201ae859fc217382\",",
        "indent": 2
      },
      {
        "content": "\"cardholder_name_encrypted\": \"FQY/TPv7A9USu5VN9OMdxTXSJ7a3w+Y1HV8lHj0=\",",
        "indent": 2
      },
      {
        "content": "\"cardholder_name_nonce\": \"d4bd8726adf662873155fa49\"",
        "indent": 2
      },
      {
        "content": "},",
        "indent": 1
      },
      {
        "content": "\"customer\": {",
        "indent": 1
      },
      {
        "content": "\"email_domain\": \"example.com\",",
        "indent": 2
      },
      {
        "content": "\"email_domain_type\": \"business\",",
        "indent": 2
      },
      {
        "content": "\"phone_country_code\": \"+1\",",
        "indent": 2
      },
      {
        "content": "\"phone_area_code\": \"415\",",
        "indent": 2
      },
      {
        "content": "\"ssn_last_four\": \"6789\",",
        "indent": 2
      },
      {
        "content": "\"email_encrypted\": \"kYxzQn3uiaoSRP2T7e1OUoHoLAoAl4jhO12cTAFr1XhdZLlnl1bJu78=\",",
        "indent": 2
      },
      {
        "content": "\"email_nonce\": \"b228b001aaf1433bfec2db4f\",",
        "indent": 2
      },
      {
        "content": "\"phone_encrypted\": \"FHavKi6h3xhC/Y/i7McfcU5mkiSgToR8hi5vQ99QBg==\",",
        "indent": 2
      },
      {
        "content": "\"phone_nonce\": \"ffa3a72cd946d9ec90ce902a\",",
        "indent": 2
      },
      {
        "content": "\"ssn_encrypted\": \"mHk4hhUSNKyrm+8uqc5zUKfgzSK0ldV3Nu9b\",",
        "indent": 2
      },
      {
        "content": "\"ssn_nonce\": \"de7c2ff8f51df67359fd7292\",",
        "indent": 2
      },
      {
        "content": "\"first_name_encrypted\": \"8bTSBScy5lspVQFfmhMTkTFE/jiw\",",
        "indent": 2
      },
      {
        "content": "\"first_name_nonce\": \"19784ba1a795818123adfa51\",",
        "indent": 2
      },
      {
        "content": "\"last_name_encrypted\": \"oYaSRzeYtC8YFd3ri+xuXgRtf1qeQ2Y=\",",
        "indent": 2
      },
      {
        "content": "\"last_name_nonce\": \"37a238b880b3e7f263499b28\",",
        "indent": 2
      },
      {
        "content": "\"birth_year\": 1985,",
        "indent": 2
      },
      {
        "content": "\"current_age\": 41,",
        "indent": 2
      },
      {
        "content": "\"age_range\": \"35_to_44\",",
        "indent": 2
      },
      {
        "content": "\"birth_decade\": \"1980s\",",
        "indent": 2
      },
      {
        "content": "\"birth_season\": \"spring\",",
        "indent": 2
      },
      {
        "content": "\"date_of_birth_encrypted\": \"AeSdHlZVlbvGjXvpTd3Y/pXiKdwgOZLQ1YE=\",",
        "indent": 2
      },
      {
        "content": "\"date_of_birth_nonce\": \"1111c29e0d4307c1780e94f9\"",
        "indent": 2
      },
      {
        "content": "},",
        "indent": 1
      },
      {
        "content": "\"billing_address\": {",
        "indent": 1
      },
      {
        "content": "\"city\": \"San Francisco\",",
        "indent": 2
      },
      {
        "content": "\"state\": \"CA\",",
        "indent": 2
      },
      {
        "content": "\"country\": \"US\",",
        "indent": 2
      },
      {
        "content": "\"zip_prefix\": \"941\",",
        "indent": 2
      },
      {
        "content": "\"metro_area\": \"sf_bay_area\",",
        "indent": 2
      },
      {
        "content": "\"street_encrypted\": \"kraUixfb9IRW1rTsdspmNM3hV2UCKNSWt1XC\",",
        "indent": 2
      },
      {
        "content": "\"street_nonce\": \"c3af7140b21eaae7d4be1b74\",",
        "indent": 2
      },
      {
        "content": "\"zip_encrypted\": \"9Y0HgXjL+O0/0OylXvpSGGi2nJW9\",",
        "indent": 2
      },
      {
        "content": "\"zip_nonce\": \"cec741b3ae70c6947a7bc394\"",
        "indent": 2
      },
      {
        "content": "},",
        "indent": 1
      },
      {
        "content": "\"shipping_address\": {",
        "indent": 1
      },
      {
        "content": "\"city\": \"San Francisco\",",
        "indent": 2
      },
      {
        "content": "\"state\": \"CA\",",
        "indent": 2
      },
      {
        "content": "\"country\": \"US\",",
        "indent": 2
      },
      {
        "content": "\"zip_prefix\": \"941\",",
        "indent": 2
      },
      {
        "content": "\"metro_area\": \"sf_bay_area\",",
        "indent": 2
      },
      {
        "content": "\"street_encrypted\": \"gsbAXd85EiIAjTx0Rw8cAkLNaR3XzWKDK1+4rwU=\",",
        "indent": 2
      },
      {
        "content": "\"street_nonce\": \"3da6fd3bc65870e32ffa7c3b\",",
        "indent": 2
      },
      {
        "content": "\"zip_encrypted\": \"zYQDTJo0l8kZPdZxrBBbpJaPVybJ\",",
        "indent": 2
      },
      {
        "content": "\"zip_nonce\": \"dd996a2c2be914f93905a46d\"",
        "indent": 2
      },
      {
        "content": "},",
        "indent": 1
      },
      {
        "content": "\"address_analysis\": {",
        "indent": 1
      },
      {
        "content": "\"same_city\": true,",
        "indent": 2
      },
      {
        "content": "\"same_state\": true,",
        "indent": 2
      },
      {
        "content": "\"same_metro\": true",
        "indent": 2
      },
      {
        "content": "}",
        "indent": 1
      },
      {
        "content": "}",
        "indent": 0
      }
    ]
  },
  {
    "id": 6,
    "slug": "illustrative-key-version-metadata",
    "title": "Illustrative Key-Version Metadata",
    "description": "Add illustrative key metadata and an audit record, reject errors, then write encrypted and audit outputs separately.",
    "inputLines": [
      {
        "content": "{",
        "indent": 0
      },
      {
        "content": "\"transaction_id\": \"txn-12345\",",
        "indent": 1
      },
      {
        "content": "\"payment\": {",
        "indent": 1
      },
      {
        "content": "\"card_last_four\": \"9010\",",
        "indent": 2
      },
      {
        "content": "\"card_bin\": \"453212\",",
        "indent": 2
      },
      {
        "content": "\"card_brand\": \"visa\",",
        "indent": 2
      },
      {
        "content": "\"card_number_encrypted\": \"lpCo/ZX8nEv4v3QMZp7j7DXPHZHZgdSisDEbapgMAYu6QJU=\",",
        "indent": 2
      },
      {
        "content": "\"card_number_nonce\": \"52860578201ae859fc217382\",",
        "indent": 2
      },
      {
        "content": "\"cardholder_name_encrypted\": \"FQY/TPv7A9USu5VN9OMdxTXSJ7a3w+Y1HV8lHj0=\",",
        "indent": 2
      },
      {
        "content": "\"cardholder_name_nonce\": \"d4bd8726adf662873155fa49\"",
        "indent": 2
      },
      {
        "content": "},",
        "indent": 1
      },
      {
        "content": "\"customer\": {",
        "indent": 1
      },
      {
        "content": "\"email_domain\": \"example.com\",",
        "indent": 2
      },
      {
        "content": "\"email_domain_type\": \"business\",",
        "indent": 2
      },
      {
        "content": "\"phone_country_code\": \"+1\",",
        "indent": 2
      },
      {
        "content": "\"phone_area_code\": \"415\",",
        "indent": 2
      },
      {
        "content": "\"ssn_last_four\": \"6789\",",
        "indent": 2
      },
      {
        "content": "\"email_encrypted\": \"kYxzQn3uiaoSRP2T7e1OUoHoLAoAl4jhO12cTAFr1XhdZLlnl1bJu78=\",",
        "indent": 2
      },
      {
        "content": "\"email_nonce\": \"b228b001aaf1433bfec2db4f\",",
        "indent": 2
      },
      {
        "content": "\"phone_encrypted\": \"FHavKi6h3xhC/Y/i7McfcU5mkiSgToR8hi5vQ99QBg==\",",
        "indent": 2
      },
      {
        "content": "\"phone_nonce\": \"ffa3a72cd946d9ec90ce902a\",",
        "indent": 2
      },
      {
        "content": "\"ssn_encrypted\": \"mHk4hhUSNKyrm+8uqc5zUKfgzSK0ldV3Nu9b\",",
        "indent": 2
      },
      {
        "content": "\"ssn_nonce\": \"de7c2ff8f51df67359fd7292\",",
        "indent": 2
      },
      {
        "content": "\"first_name_encrypted\": \"8bTSBScy5lspVQFfmhMTkTFE/jiw\",",
        "indent": 2
      },
      {
        "content": "\"first_name_nonce\": \"19784ba1a795818123adfa51\",",
        "indent": 2
      },
      {
        "content": "\"last_name_encrypted\": \"oYaSRzeYtC8YFd3ri+xuXgRtf1qeQ2Y=\",",
        "indent": 2
      },
      {
        "content": "\"last_name_nonce\": \"37a238b880b3e7f263499b28\",",
        "indent": 2
      },
      {
        "content": "\"birth_year\": 1985,",
        "indent": 2
      },
      {
        "content": "\"current_age\": 41,",
        "indent": 2
      },
      {
        "content": "\"age_range\": \"35_to_44\",",
        "indent": 2
      },
      {
        "content": "\"birth_decade\": \"1980s\",",
        "indent": 2
      },
      {
        "content": "\"birth_season\": \"spring\",",
        "indent": 2
      },
      {
        "content": "\"date_of_birth_encrypted\": \"AeSdHlZVlbvGjXvpTd3Y/pXiKdwgOZLQ1YE=\",",
        "indent": 2
      },
      {
        "content": "\"date_of_birth_nonce\": \"1111c29e0d4307c1780e94f9\"",
        "indent": 2
      },
      {
        "content": "},",
        "indent": 1
      },
      {
        "content": "\"billing_address\": {",
        "indent": 1
      },
      {
        "content": "\"city\": \"San Francisco\",",
        "indent": 2
      },
      {
        "content": "\"state\": \"CA\",",
        "indent": 2
      },
      {
        "content": "\"country\": \"US\",",
        "indent": 2
      },
      {
        "content": "\"zip_prefix\": \"941\",",
        "indent": 2
      },
      {
        "content": "\"metro_area\": \"sf_bay_area\",",
        "indent": 2
      },
      {
        "content": "\"street_encrypted\": \"kraUixfb9IRW1rTsdspmNM3hV2UCKNSWt1XC\",",
        "indent": 2
      },
      {
        "content": "\"street_nonce\": \"c3af7140b21eaae7d4be1b74\",",
        "indent": 2
      },
      {
        "content": "\"zip_encrypted\": \"9Y0HgXjL+O0/0OylXvpSGGi2nJW9\",",
        "indent": 2
      },
      {
        "content": "\"zip_nonce\": \"cec741b3ae70c6947a7bc394\"",
        "indent": 2
      },
      {
        "content": "},",
        "indent": 1
      },
      {
        "content": "\"shipping_address\": {",
        "indent": 1
      },
      {
        "content": "\"city\": \"San Francisco\",",
        "indent": 2
      },
      {
        "content": "\"state\": \"CA\",",
        "indent": 2
      },
      {
        "content": "\"country\": \"US\",",
        "indent": 2
      },
      {
        "content": "\"zip_prefix\": \"941\",",
        "indent": 2
      },
      {
        "content": "\"metro_area\": \"sf_bay_area\",",
        "indent": 2
      },
      {
        "content": "\"street_encrypted\": \"gsbAXd85EiIAjTx0Rw8cAkLNaR3XzWKDK1+4rwU=\",",
        "indent": 2
      },
      {
        "content": "\"street_nonce\": \"3da6fd3bc65870e32ffa7c3b\",",
        "indent": 2
      },
      {
        "content": "\"zip_encrypted\": \"zYQDTJo0l8kZPdZxrBBbpJaPVybJ\",",
        "indent": 2
      },
      {
        "content": "\"zip_nonce\": \"dd996a2c2be914f93905a46d\"",
        "indent": 2
      },
      {
        "content": "},",
        "indent": 1
      },
      {
        "content": "\"address_analysis\": {",
        "indent": 1
      },
      {
        "content": "\"same_city\": true,",
        "indent": 2
      },
      {
        "content": "\"same_state\": true,",
        "indent": 2
      },
      {
        "content": "\"same_metro\": true",
        "indent": 2
      },
      {
        "content": "}",
        "indent": 1
      },
      {
        "content": "}",
        "indent": 0
      }
    ],
    "outputLines": [
      {
        "content": "{",
        "indent": 0
      },
      {
        "content": "\"transaction_id\": \"txn-12345\",",
        "indent": 1
      },
      {
        "content": "\"payment\": {",
        "indent": 1
      },
      {
        "content": "\"card_last_four\": \"9010\",",
        "indent": 2
      },
      {
        "content": "\"card_bin\": \"453212\",",
        "indent": 2
      },
      {
        "content": "\"card_brand\": \"visa\",",
        "indent": 2
      },
      {
        "content": "\"card_number_encrypted\": \"lpCo/ZX8nEv4v3QMZp7j7DXPHZHZgdSisDEbapgMAYu6QJU=\",",
        "indent": 2
      },
      {
        "content": "\"card_number_nonce\": \"52860578201ae859fc217382\",",
        "indent": 2
      },
      {
        "content": "\"cardholder_name_encrypted\": \"FQY/TPv7A9USu5VN9OMdxTXSJ7a3w+Y1HV8lHj0=\",",
        "indent": 2
      },
      {
        "content": "\"cardholder_name_nonce\": \"d4bd8726adf662873155fa49\"",
        "indent": 2
      },
      {
        "content": "},",
        "indent": 1
      },
      {
        "content": "\"customer\": {",
        "indent": 1
      },
      {
        "content": "\"email_domain\": \"example.com\",",
        "indent": 2
      },
      {
        "content": "\"email_domain_type\": \"business\",",
        "indent": 2
      },
      {
        "content": "\"phone_country_code\": \"+1\",",
        "indent": 2
      },
      {
        "content": "\"phone_area_code\": \"415\",",
        "indent": 2
      },
      {
        "content": "\"ssn_last_four\": \"6789\",",
        "indent": 2
      },
      {
        "content": "\"email_encrypted\": \"kYxzQn3uiaoSRP2T7e1OUoHoLAoAl4jhO12cTAFr1XhdZLlnl1bJu78=\",",
        "indent": 2
      },
      {
        "content": "\"email_nonce\": \"b228b001aaf1433bfec2db4f\",",
        "indent": 2
      },
      {
        "content": "\"phone_encrypted\": \"FHavKi6h3xhC/Y/i7McfcU5mkiSgToR8hi5vQ99QBg==\",",
        "indent": 2
      },
      {
        "content": "\"phone_nonce\": \"ffa3a72cd946d9ec90ce902a\",",
        "indent": 2
      },
      {
        "content": "\"ssn_encrypted\": \"mHk4hhUSNKyrm+8uqc5zUKfgzSK0ldV3Nu9b\",",
        "indent": 2
      },
      {
        "content": "\"ssn_nonce\": \"de7c2ff8f51df67359fd7292\",",
        "indent": 2
      },
      {
        "content": "\"first_name_encrypted\": \"8bTSBScy5lspVQFfmhMTkTFE/jiw\",",
        "indent": 2
      },
      {
        "content": "\"first_name_nonce\": \"19784ba1a795818123adfa51\",",
        "indent": 2
      },
      {
        "content": "\"last_name_encrypted\": \"oYaSRzeYtC8YFd3ri+xuXgRtf1qeQ2Y=\",",
        "indent": 2
      },
      {
        "content": "\"last_name_nonce\": \"37a238b880b3e7f263499b28\",",
        "indent": 2
      },
      {
        "content": "\"birth_year\": 1985,",
        "indent": 2
      },
      {
        "content": "\"current_age\": 41,",
        "indent": 2
      },
      {
        "content": "\"age_range\": \"35_to_44\",",
        "indent": 2
      },
      {
        "content": "\"birth_decade\": \"1980s\",",
        "indent": 2
      },
      {
        "content": "\"birth_season\": \"spring\",",
        "indent": 2
      },
      {
        "content": "\"date_of_birth_encrypted\": \"AeSdHlZVlbvGjXvpTd3Y/pXiKdwgOZLQ1YE=\",",
        "indent": 2
      },
      {
        "content": "\"date_of_birth_nonce\": \"1111c29e0d4307c1780e94f9\"",
        "indent": 2
      },
      {
        "content": "},",
        "indent": 1
      },
      {
        "content": "\"billing_address\": {",
        "indent": 1
      },
      {
        "content": "\"city\": \"San Francisco\",",
        "indent": 2
      },
      {
        "content": "\"state\": \"CA\",",
        "indent": 2
      },
      {
        "content": "\"country\": \"US\",",
        "indent": 2
      },
      {
        "content": "\"zip_prefix\": \"941\",",
        "indent": 2
      },
      {
        "content": "\"metro_area\": \"sf_bay_area\",",
        "indent": 2
      },
      {
        "content": "\"street_encrypted\": \"kraUixfb9IRW1rTsdspmNM3hV2UCKNSWt1XC\",",
        "indent": 2
      },
      {
        "content": "\"street_nonce\": \"c3af7140b21eaae7d4be1b74\",",
        "indent": 2
      },
      {
        "content": "\"zip_encrypted\": \"9Y0HgXjL+O0/0OylXvpSGGi2nJW9\",",
        "indent": 2
      },
      {
        "content": "\"zip_nonce\": \"cec741b3ae70c6947a7bc394\"",
        "indent": 2
      },
      {
        "content": "},",
        "indent": 1
      },
      {
        "content": "\"shipping_address\": {",
        "indent": 1
      },
      {
        "content": "\"city\": \"San Francisco\",",
        "indent": 2
      },
      {
        "content": "\"state\": \"CA\",",
        "indent": 2
      },
      {
        "content": "\"country\": \"US\",",
        "indent": 2
      },
      {
        "content": "\"zip_prefix\": \"941\",",
        "indent": 2
      },
      {
        "content": "\"metro_area\": \"sf_bay_area\",",
        "indent": 2
      },
      {
        "content": "\"street_encrypted\": \"gsbAXd85EiIAjTx0Rw8cAkLNaR3XzWKDK1+4rwU=\",",
        "indent": 2
      },
      {
        "content": "\"street_nonce\": \"3da6fd3bc65870e32ffa7c3b\",",
        "indent": 2
      },
      {
        "content": "\"zip_encrypted\": \"zYQDTJo0l8kZPdZxrBBbpJaPVybJ\",",
        "indent": 2
      },
      {
        "content": "\"zip_nonce\": \"dd996a2c2be914f93905a46d\"",
        "indent": 2
      },
      {
        "content": "},",
        "indent": 1
      },
      {
        "content": "\"address_analysis\": {",
        "indent": 1
      },
      {
        "content": "\"same_city\": true,",
        "indent": 2
      },
      {
        "content": "\"same_state\": true,",
        "indent": 2
      },
      {
        "content": "\"same_metro\": true",
        "indent": 2
      },
      {
        "content": "},",
        "indent": 1
      },
      {
        "content": "\"multi_key_metadata\": {",
        "indent": 1
      },
      {
        "content": "\"encryption_architecture\": \"multi_tier_risk_based\",",
        "indent": 2
      },
      {
        "content": "\"key_tiers_used\": {",
        "indent": 2
      },
      {
        "content": "\"payment_critical\": {",
        "indent": 3
      },
      {
        "content": "\"rotation_schedule_days\": 90,",
        "indent": 4
      },
      {
        "content": "\"compliance_standards\": [",
        "indent": 4
      },
      {
        "content": "\"PCI-DSS\"",
        "indent": 5
      },
      {
        "content": "],",
        "indent": 4
      },
      {
        "content": "\"access_control\": \"payment_processor_only\"",
        "indent": 4
      },
      {
        "content": "},",
        "indent": 3
      },
      {
        "content": "\"pii_high\": {",
        "indent": 3
      },
      {
        "content": "\"rotation_schedule_days\": 180,",
        "indent": 4
      },
      {
        "content": "\"compliance_standards\": [",
        "indent": 4
      },
      {
        "content": "\"GDPR\",",
        "indent": 5
      },
      {
        "content": "\"CCPA\"",
        "indent": 5
      },
      {
        "content": "],",
        "indent": 4
      },
      {
        "content": "\"access_control\": \"customer_service_analytics\"",
        "indent": 4
      },
      {
        "content": "},",
        "indent": 3
      },
      {
        "content": "\"location_medium\": {",
        "indent": 3
      },
      {
        "content": "\"rotation_schedule_days\": 365,",
        "indent": 4
      },
      {
        "content": "\"compliance_standards\": [",
        "indent": 4
      },
      {
        "content": "\"location_privacy\"",
        "indent": 5
      },
      {
        "content": "]",
        "indent": 4
      },
      {
        "content": "},",
        "indent": 3
      },
      {
        "content": "\"temporal_medium\": {",
        "indent": 3
      },
      {
        "content": "\"rotation_schedule_days\": 365,",
        "indent": 4
      },
      {
        "content": "\"compliance_standards\": [",
        "indent": 4
      },
      {
        "content": "\"HIPAA\"",
        "indent": 5
      },
      {
        "content": "]",
        "indent": 4
      },
      {
        "content": "}",
        "indent": 3
      },
      {
        "content": "}",
        "indent": 2
      },
      {
        "content": "},",
        "indent": 1
      },
      {
        "content": "\"operational_metrics\": {",
        "indent": 1
      },
      {
        "content": "\"pipeline_health\": \"optimal\",",
        "indent": 2
      },
      {
        "content": "\"selected_field_count\": 12,",
        "indent": 2
      },
      {
        "content": "\"key_version\": \"fixture-v1\",",
        "indent": 2
      },
      {
        "content": "\"fixture_status\": \"illustrative\"",
        "indent": 2
      },
      {
        "content": "}",
        "indent": 1
      },
      {
        "content": "}",
        "indent": 0
      }
    ]
  }
];
