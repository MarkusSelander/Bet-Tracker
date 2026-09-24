from fx import nok_per_usd
import pytest


def test_nok_per_usd_reads_frankfurter_rate():
    assert nok_per_usd({"base": "USD", "rates": {"NOK": 10.4567}}) == 10.4567


def test_nok_per_usd_rejects_missing_rate():
    with pytest.raises(ValueError):
        nok_per_usd({"rates": {}})
