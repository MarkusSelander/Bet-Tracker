from mongo import mongo_client_kwargs, uses_tls


def test_local_mongodb_does_not_force_tls():
    kwargs = mongo_client_kwargs("mongodb://127.0.0.1:27017")

    assert uses_tls("mongodb://127.0.0.1:27017") is False
    assert "tlsCAFile" not in kwargs
    assert kwargs["serverSelectionTimeoutMS"] == 8000
    assert kwargs["connectTimeoutMS"] == 5000


def test_atlas_srv_uses_certifi_and_short_timeouts():
    kwargs = mongo_client_kwargs(
        "mongodb+srv://user:pass@cluster.mongodb.net",
        ca_file="/tmp/test-ca.pem",
    )

    assert uses_tls("mongodb+srv://user:pass@cluster.mongodb.net") is True
    assert kwargs["tlsCAFile"] == "/tmp/test-ca.pem"
    assert kwargs["serverSelectionTimeoutMS"] == 8000
    assert kwargs["connectTimeoutMS"] == 5000
