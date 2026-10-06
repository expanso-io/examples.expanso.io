import type { Stage } from '@site/src/components/DataPipelineExplorer/types';

export const encryptDataStages: Stage[] = [
  {
    "id": 1,
    "slug": "original-payment-data",
    "title": "Step 1: Original Payment Data",
    "description": "Start with a synthetic payment record containing clear payment, identity, and location fields.",
    "inputLines": [
      {
        "content": "{",
        "indent": 0
      },
      {
        "content": "\"transaction_id\": \"txn_20251020_001\",",
        "indent": 1
      },
      {
        "content": "\"timestamp\": \"2025-10-20T14:30:00Z\",",
        "indent": 1
      },
      {
        "content": "\"merchant_id\": \"merchant_789\",",
        "indent": 1
      },
      {
        "content": "\"amount\": 127.5,",
        "indent": 1
      },
      {
        "content": "\"currency\": \"USD\",",
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
        "content": "\"expiration\": \"12/27\",",
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
        "content": "\"city\": \"San Francisco\",",
        "indent": 2
      },
      {
        "content": "\"state\": \"CA\",",
        "indent": 2
      },
      {
        "content": "\"zip\": \"94102\",",
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
        "content": "\"transaction_id\": \"txn_20251020_001\",",
        "indent": 1
      },
      {
        "content": "\"timestamp\": \"2025-10-20T14:30:00Z\",",
        "indent": 1
      },
      {
        "content": "\"merchant_id\": \"merchant_789\",",
        "indent": 1
      },
      {
        "content": "\"amount\": 127.5,",
        "indent": 1
      },
      {
        "content": "\"currency\": \"USD\",",
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
        "content": "\"expiration\": \"12/27\",",
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
        "content": "\"city\": \"San Francisco\",",
        "indent": 2
      },
      {
        "content": "\"state\": \"CA\",",
        "indent": 2
      },
      {
        "content": "\"zip\": \"94102\",",
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
    "slug": "encrypt-credit-card-data",
    "title": "Step 2: Encrypt Credit Card Data",
    "description": "Encrypt the card number and name with AES-GCM, retain their nonces, and delete CVV.",
    "inputLines": [
      {
        "content": "{",
        "indent": 0
      },
      {
        "content": "\"transaction_id\": \"txn_20251020_001\",",
        "indent": 1
      },
      {
        "content": "\"timestamp\": \"2025-10-20T14:30:00Z\",",
        "indent": 1
      },
      {
        "content": "\"merchant_id\": \"merchant_789\",",
        "indent": 1
      },
      {
        "content": "\"amount\": 127.5,",
        "indent": 1
      },
      {
        "content": "\"currency\": \"USD\",",
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
        "content": "\"expiration\": \"12/27\",",
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
        "content": "\"city\": \"San Francisco\",",
        "indent": 2
      },
      {
        "content": "\"state\": \"CA\",",
        "indent": 2
      },
      {
        "content": "\"zip\": \"94102\",",
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
        "content": "\"transaction_id\": \"txn_20251020_001\",",
        "indent": 1
      },
      {
        "content": "\"timestamp\": \"2025-10-20T14:30:00Z\",",
        "indent": 1
      },
      {
        "content": "\"merchant_id\": \"merchant_789\",",
        "indent": 1
      },
      {
        "content": "\"amount\": 127.5,",
        "indent": 1
      },
      {
        "content": "\"currency\": \"USD\",",
        "indent": 1
      },
      {
        "content": "\"payment\": {",
        "indent": 1
      },
      {
        "content": "\"expiration\": \"12/27\",",
        "indent": 2
      },
      {
        "content": "\"card_last_four\": \"9010\",",
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
        "content": "\"city\": \"San Francisco\",",
        "indent": 2
      },
      {
        "content": "\"state\": \"CA\",",
        "indent": 2
      },
      {
        "content": "\"zip\": \"94102\",",
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
    "slug": "encrypt-pii-customer-data",
    "title": "Step 3: Encrypt PII Customer Data",
    "description": "Encrypt identity fields with AES-GCM and retain nonces and derived analytics fields.",
    "inputLines": [
      {
        "content": "{",
        "indent": 0
      },
      {
        "content": "\"transaction_id\": \"txn_20251020_001\",",
        "indent": 1
      },
      {
        "content": "\"timestamp\": \"2025-10-20T14:30:00Z\",",
        "indent": 1
      },
      {
        "content": "\"merchant_id\": \"merchant_789\",",
        "indent": 1
      },
      {
        "content": "\"amount\": 127.5,",
        "indent": 1
      },
      {
        "content": "\"currency\": \"USD\",",
        "indent": 1
      },
      {
        "content": "\"payment\": {",
        "indent": 1
      },
      {
        "content": "\"expiration\": \"12/27\",",
        "indent": 2
      },
      {
        "content": "\"card_last_four\": \"9010\",",
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
        "content": "\"city\": \"San Francisco\",",
        "indent": 2
      },
      {
        "content": "\"state\": \"CA\",",
        "indent": 2
      },
      {
        "content": "\"zip\": \"94102\",",
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
        "content": "\"transaction_id\": \"txn_20251020_001\",",
        "indent": 1
      },
      {
        "content": "\"timestamp\": \"2025-10-20T14:30:00Z\",",
        "indent": 1
      },
      {
        "content": "\"merchant_id\": \"merchant_789\",",
        "indent": 1
      },
      {
        "content": "\"amount\": 127.5,",
        "indent": 1
      },
      {
        "content": "\"currency\": \"USD\",",
        "indent": 1
      },
      {
        "content": "\"payment\": {",
        "indent": 1
      },
      {
        "content": "\"expiration\": \"12/27\",",
        "indent": 2
      },
      {
        "content": "\"card_last_four\": \"9010\",",
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
        "content": "\"ssn_last_four\": \"6789\",",
        "indent": 2
      },
      {
        "content": "\"email_domain\": \"example.com\",",
        "indent": 2
      },
      {
        "content": "\"phone_area_code\": \"141\",",
        "indent": 2
      },
      {
        "content": "\"birth_year\": 1985,",
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
        "content": "\"street\": \"123 Main St\",",
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
        "content": "\"zip\": \"94102\",",
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
    "slug": "encrypt-address-data",
    "title": "Step 4: Encrypt Address Data",
    "description": "Select street and postal-code fields while retaining city, state, and country in the authored output.",
    "inputLines": [
      {
        "content": "{",
        "indent": 0
      },
      {
        "content": "\"transaction_id\": \"txn_20251020_001\",",
        "indent": 1
      },
      {
        "content": "\"timestamp\": \"2025-10-20T14:30:00Z\",",
        "indent": 1
      },
      {
        "content": "\"merchant_id\": \"merchant_789\",",
        "indent": 1
      },
      {
        "content": "\"amount\": 127.5,",
        "indent": 1
      },
      {
        "content": "\"currency\": \"USD\",",
        "indent": 1
      },
      {
        "content": "\"payment\": {",
        "indent": 1
      },
      {
        "content": "\"expiration\": \"12/27\",",
        "indent": 2
      },
      {
        "content": "\"card_last_four\": \"9010\",",
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
        "content": "\"ssn_last_four\": \"6789\",",
        "indent": 2
      },
      {
        "content": "\"email_domain\": \"example.com\",",
        "indent": 2
      },
      {
        "content": "\"phone_area_code\": \"141\",",
        "indent": 2
      },
      {
        "content": "\"birth_year\": 1985,",
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
        "content": "\"street\": \"123 Main St\",",
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
        "content": "\"zip\": \"94102\",",
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
        "content": "\"transaction_id\": \"txn_20251020_001\",",
        "indent": 1
      },
      {
        "content": "\"timestamp\": \"2025-10-20T14:30:00Z\",",
        "indent": 1
      },
      {
        "content": "\"merchant_id\": \"merchant_789\",",
        "indent": 1
      },
      {
        "content": "\"amount\": 127.5,",
        "indent": 1
      },
      {
        "content": "\"currency\": \"USD\",",
        "indent": 1
      },
      {
        "content": "\"payment\": {",
        "indent": 1
      },
      {
        "content": "\"expiration\": \"12/27\",",
        "indent": 2
      },
      {
        "content": "\"card_last_four\": \"9010\",",
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
        "content": "\"ssn_last_four\": \"6789\",",
        "indent": 2
      },
      {
        "content": "\"email_domain\": \"example.com\",",
        "indent": 2
      },
      {
        "content": "\"phone_area_code\": \"141\",",
        "indent": 2
      },
      {
        "content": "\"birth_year\": 1985,",
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
        "content": "\"street_encrypted\": \"kraUixfb9IRW1rTsdspmNM3hV2UCKNSWt1XC\",",
        "indent": 2
      },
      {
        "content": "\"street_nonce\": \"c3af7140b21eaae7d4be1b74\",",
        "indent": 2
      },
      {
        "content": "\"zip_encrypted\": \"9Y0HgXmp1hsFBdZZSNWvM+Vm9lbD\",",
        "indent": 2
      },
      {
        "content": "\"zip_nonce\": \"cec741b3ae70c6947a7bc394\"",
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
    "slug": "add-encryption-metadata",
    "title": "Step 5: Add Encryption Metadata",
    "description": "Add encryption metadata; timestamps and key version shown here are fixture values.",
    "inputLines": [
      {
        "content": "{",
        "indent": 0
      },
      {
        "content": "\"transaction_id\": \"txn_20251020_001\",",
        "indent": 1
      },
      {
        "content": "\"timestamp\": \"2025-10-20T14:30:00Z\",",
        "indent": 1
      },
      {
        "content": "\"merchant_id\": \"merchant_789\",",
        "indent": 1
      },
      {
        "content": "\"amount\": 127.5,",
        "indent": 1
      },
      {
        "content": "\"currency\": \"USD\",",
        "indent": 1
      },
      {
        "content": "\"payment\": {",
        "indent": 1
      },
      {
        "content": "\"expiration\": \"12/27\",",
        "indent": 2
      },
      {
        "content": "\"card_last_four\": \"9010\",",
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
        "content": "\"ssn_last_four\": \"6789\",",
        "indent": 2
      },
      {
        "content": "\"email_domain\": \"example.com\",",
        "indent": 2
      },
      {
        "content": "\"phone_area_code\": \"141\",",
        "indent": 2
      },
      {
        "content": "\"birth_year\": 1985,",
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
        "content": "\"street_encrypted\": \"kraUixfb9IRW1rTsdspmNM3hV2UCKNSWt1XC\",",
        "indent": 2
      },
      {
        "content": "\"street_nonce\": \"c3af7140b21eaae7d4be1b74\",",
        "indent": 2
      },
      {
        "content": "\"zip_encrypted\": \"9Y0HgXmp1hsFBdZZSNWvM+Vm9lbD\",",
        "indent": 2
      },
      {
        "content": "\"zip_nonce\": \"cec741b3ae70c6947a7bc394\"",
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
        "content": "\"transaction_id\": \"txn_20251020_001\",",
        "indent": 1
      },
      {
        "content": "\"timestamp\": \"2025-10-20T14:30:00Z\",",
        "indent": 1
      },
      {
        "content": "\"merchant_id\": \"merchant_789\",",
        "indent": 1
      },
      {
        "content": "\"amount\": 127.5,",
        "indent": 1
      },
      {
        "content": "\"currency\": \"USD\",",
        "indent": 1
      },
      {
        "content": "\"payment\": {",
        "indent": 1
      },
      {
        "content": "\"expiration\": \"12/27\",",
        "indent": 2
      },
      {
        "content": "\"card_last_four\": \"9010\",",
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
        "content": "\"ssn_last_four\": \"6789\",",
        "indent": 2
      },
      {
        "content": "\"email_domain\": \"example.com\",",
        "indent": 2
      },
      {
        "content": "\"phone_area_code\": \"141\",",
        "indent": 2
      },
      {
        "content": "\"birth_year\": 1985,",
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
        "content": "\"street_encrypted\": \"kraUixfb9IRW1rTsdspmNM3hV2UCKNSWt1XC\",",
        "indent": 2
      },
      {
        "content": "\"street_nonce\": \"c3af7140b21eaae7d4be1b74\",",
        "indent": 2
      },
      {
        "content": "\"zip_encrypted\": \"9Y0HgXmp1hsFBdZZSNWvM+Vm9lbD\",",
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
        "content": "\"encryption_metadata\": {",
        "indent": 1
      },
      {
        "content": "\"encrypted\": true,",
        "indent": 2
      },
      {
        "content": "\"encryption_timestamp\": \"2025-10-20T14:30:00Z\",",
        "indent": 2
      },
      {
        "content": "\"key_version\": \"fixture-v1\",",
        "indent": 2
      },
      {
        "content": "\"algorithm\": \"AES-256-GCM\",",
        "indent": 2
      },
      {
        "content": "\"node_id\": \"fixture-node\"",
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
    "slug": "complete-encrypted-transaction",
    "title": "Step 6: Complete Encrypted Transaction",
    "description": "Reject errored records before forwarding the encrypted transaction to both authenticated destinations.",
    "inputLines": [
      {
        "content": "{",
        "indent": 0
      },
      {
        "content": "\"transaction_id\": \"txn_20251020_001\",",
        "indent": 1
      },
      {
        "content": "\"timestamp\": \"2025-10-20T14:30:00Z\",",
        "indent": 1
      },
      {
        "content": "\"merchant_id\": \"merchant_789\",",
        "indent": 1
      },
      {
        "content": "\"amount\": 127.5,",
        "indent": 1
      },
      {
        "content": "\"currency\": \"USD\",",
        "indent": 1
      },
      {
        "content": "\"payment\": {",
        "indent": 1
      },
      {
        "content": "\"expiration\": \"12/27\",",
        "indent": 2
      },
      {
        "content": "\"card_last_four\": \"9010\",",
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
        "content": "\"ssn_last_four\": \"6789\",",
        "indent": 2
      },
      {
        "content": "\"email_domain\": \"example.com\",",
        "indent": 2
      },
      {
        "content": "\"phone_area_code\": \"141\",",
        "indent": 2
      },
      {
        "content": "\"birth_year\": 1985,",
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
        "content": "\"street_encrypted\": \"kraUixfb9IRW1rTsdspmNM3hV2UCKNSWt1XC\",",
        "indent": 2
      },
      {
        "content": "\"street_nonce\": \"c3af7140b21eaae7d4be1b74\",",
        "indent": 2
      },
      {
        "content": "\"zip_encrypted\": \"9Y0HgXmp1hsFBdZZSNWvM+Vm9lbD\",",
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
        "content": "\"encryption_metadata\": {",
        "indent": 1
      },
      {
        "content": "\"encrypted\": true,",
        "indent": 2
      },
      {
        "content": "\"encryption_timestamp\": \"2025-10-20T14:30:00Z\",",
        "indent": 2
      },
      {
        "content": "\"key_version\": \"fixture-v1\",",
        "indent": 2
      },
      {
        "content": "\"algorithm\": \"AES-256-GCM\",",
        "indent": 2
      },
      {
        "content": "\"node_id\": \"fixture-node\"",
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
        "content": "\"transaction_id\": \"txn_20251020_001\",",
        "indent": 1
      },
      {
        "content": "\"timestamp\": \"2025-10-20T14:30:00Z\",",
        "indent": 1
      },
      {
        "content": "\"merchant_id\": \"merchant_789\",",
        "indent": 1
      },
      {
        "content": "\"amount\": 127.5,",
        "indent": 1
      },
      {
        "content": "\"currency\": \"USD\",",
        "indent": 1
      },
      {
        "content": "\"payment\": {",
        "indent": 1
      },
      {
        "content": "\"expiration\": \"12/27\",",
        "indent": 2
      },
      {
        "content": "\"card_last_four\": \"9010\",",
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
        "content": "\"ssn_last_four\": \"6789\",",
        "indent": 2
      },
      {
        "content": "\"email_domain\": \"example.com\",",
        "indent": 2
      },
      {
        "content": "\"phone_area_code\": \"141\",",
        "indent": 2
      },
      {
        "content": "\"birth_year\": 1985,",
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
        "content": "\"street_encrypted\": \"kraUixfb9IRW1rTsdspmNM3hV2UCKNSWt1XC\",",
        "indent": 2
      },
      {
        "content": "\"street_nonce\": \"c3af7140b21eaae7d4be1b74\",",
        "indent": 2
      },
      {
        "content": "\"zip_encrypted\": \"9Y0HgXmp1hsFBdZZSNWvM+Vm9lbD\",",
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
        "content": "\"encryption_metadata\": {",
        "indent": 1
      },
      {
        "content": "\"encrypted\": true,",
        "indent": 2
      },
      {
        "content": "\"encryption_timestamp\": \"2025-10-20T14:30:00Z\",",
        "indent": 2
      },
      {
        "content": "\"key_version\": \"fixture-v1\",",
        "indent": 2
      },
      {
        "content": "\"algorithm\": \"AES-256-GCM\",",
        "indent": 2
      },
      {
        "content": "\"node_id\": \"fixture-node\"",
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
