from fx import nok_per_usd, nok_per_usd_from_norges_bank
import pytest


def test_nok_per_usd_reads_frankfurter_rate():
    assert nok_per_usd({"base": "USD", "rates": {"NOK": 10.4567}}) == 10.4567


def test_norges_bank_csv_uses_latest_observation():
    csv_text = (
        "FREQ;TIME_PERIOD;OBS_VALUE\n"
        "B;2026-09-23;9.4000\n"
        "B;2026-09-24;9.492\n"
    )
    assert nok_per_usd_from_norges_bank(csv_text) == 9.492


def test_nok_per_usd_rejects_missing_rate():
    with pytest.raises(ValueError):
        nok_per_usd({"rates": {}})
