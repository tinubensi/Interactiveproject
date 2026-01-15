import os
import json
import base64
from azure.storage.queue import QueueClient
import subprocess

def get_storage_conn_string():
    cmd = "az storage account show-connection-string --name crmrpastorage36434 --resource-group Interactive-CRM-Dev --query connectionString -o tsv"
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return result.stdout.strip()

def enqueue_message():
    conn_str = get_storage_conn_string()
    if not conn_str:
        print("Failed to get storage connection string")
        return

    queue_client = QueueClient.from_connection_string(conn_str, "rpa-jobs")
    
    payload = {
        "vendorId": "vendor-alsagr",
        "leadData": {
            "id": "aab0a6f7-21f7-454c-9e85-28050c1d5462",
            "firstName": "rpa",
            "lastName": "finaltest",
            "phone": { "number": "0501234567", "countryCode": "+971", "isoCode": "AE" },
            "lobData": {
                "dateOfBirth": "1990-01-01",
                "salaryRange": "5000-10000",
                "emirate": "Dubai",
                "gender": "Male",
                "maritalStatus": "Single",
                "residency": "Dubai",
                "nationality": "United Arab Emirates"
            }
        }
    }
    
    message = json.dumps(payload)
    # Azure Queue usually expects Base64 if client doesn't handle it, but python SDK handles encoding usually.
    # But queue_consumer expects base64 or json.
    # queue_consumer attempts to decode base64.
    # Let's send raw string, SDK encodes it to base64 by default in V12?
    # Actually, default message_encode_policy is TextBase64EncodePolicy.
    
    print(f"Enqueueing message: {message}")
    queue_client.send_message(message)
    print("✅ Message enqueued")

if __name__ == "__main__":
    enqueue_message()


