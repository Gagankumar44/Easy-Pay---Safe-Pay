import hashlib
import hmac
import json
import time
from uuid import uuid4
import pytest
from fastapi.testclient import TestClient
from main import app
from storage import database, read_record, list_records
from test_workflows import client, confirmed_attempt
from phone_assistant import auth_buffers

@pytest.fixture(autouse=True)
def clear_auth_buffers():
    auth_buffers.clear()

def turn(client,state,message,language="en-IN"):
    response = client.post("/api/assistant/chat",json={"session_id":state.get("session_id"),"message":message,"language":language})
    assert response.status_code==200,response.text
    return response.json()

@pytest.mark.parametrize("language,utterance,recipient,amount,purpose",[
 ("en-IN","Send money","Ramesh","five hundred","groceries"),
 ("hi-IN","पैसे भेजो","रमेश","पाँच सौ","किराने"),
 ("kn-IN","ಹಣ ಕಳುಹಿಸು","ರಮೇಶ್","ಐನೂರು","ದಿನಸಿ")])
def test_dynamic_questions_and_intent_readback(client,language,utterance,recipient,amount,purpose):
    state=turn(client,{},utterance,language)
    assert state["step"]=="recipient"
    state=turn(client,state,recipient,language);assert state["step"]=="amount"
    state=turn(client,state,amount,language);assert state["step"]=="purpose"
    state=turn(client,state,purpose,language)
    assert state["step"]=="review" and recipient in state["reply"] and "500.00" in state["reply"]
    assert not state["intent_confirmed"] and state["next_action"] is None
    state=turn(client,state,{"en-IN":"yes","hi-IN":"हाँ","kn-IN":"ಹೌದು"}[language],language)
    assert state["intent_confirmed"] and state["next_action"]=="/send-money"
    assert client.get("/api/demo-payments/history").json()==[]
    state=turn(client,state,"change amount",language)
    assert not state["intent_confirmed"] and state["step"]=="amount" and state["next_action"] is None

def test_unknown_questions_and_task_switch(client):
    state=turn(client,{},"hello")
    assert state["step"]=="start" and "electricity" in state["reply"]
    state=turn(client,state,"send 500")
    state=turn(client,state,"I don't know")
    assert state["step"]=="recipient" and not state["slots"]["recipient"]
    state=turn(client,state,"pay my electricity bill")
    assert state["step"]=="provider" and state["slots"]["amount"] is None


def test_report_resume_matches_both_sources_and_keeps_new_context(client):
    payment = client.post("/api/demo-payments", json=confirmed_attempt(client)).json()
    first = client.post("/api/fraud/sessions", json={"payment_id":payment["id"]}).json()
    assert client.post("/api/fraud/sessions", json={"payment_id":payment["id"]}).json()["session_id"] == first["session_id"]
    chat = turn(client, {}, "A caller asked me to move money to a safe account")
    body = {"payment_id":payment["id"], "conversation_id":chat["session_id"]}
    with_context = client.post("/api/fraud/sessions", json=body).json()
    assert with_context["session_id"] != first["session_id"]
    assert "safe account" in with_context["incident"]["conversation_context"]
    assert client.post("/api/fraud/sessions", json=body).json()["session_id"] == with_context["session_id"]
    turn(client, chat, "They also asked to install AnyDesk")
    updated = client.post("/api/fraud/sessions", json=body).json()
    assert updated["session_id"] != with_context["session_id"]
    assert "AnyDesk" in updated["incident"]["conversation_context"]
    client.delete("/api/incidents/" + updated["incident"]["id"])
    assert client.post("/api/fraud/sessions", json=body).json()["incident"]["id"] != updated["incident"]["id"]

def test_bill_collected_and_bound_to_review(client):
    state=turn(client,{},"Pay electricity bill")
    assert state["step"]=="provider" and len(state["choices"])==2
    state=turn(client,state,"Karnataka")
    assert state["step"]=="consumer"
    state=turn(client,state,"123")
    assert state["step"]=="consumer" and state["summary"] is None
    state=turn(client,state,"12345678")
    assert state["step"]=="bill_review" and state["bill"]["consumer_number"]=="12345678"
    assert state["summary"]["bill_id"]==state["bill"]["id"]
    reviewed=client.post("/api/payments/review",json=state["summary"])
    assert reviewed.status_code==200
    assert client.post("/api/payments/review",json={**state["summary"],"amount":"900"}).status_code==409

def test_status_returns_owned_receipts_only(client):
    receipt=client.post("/api/demo-payments",json=confirmed_attempt(client)).json()
    state=turn(client,{},"check payment status")
    assert state["choices"][0]["href"]=="/payment-result/"+receipt["id"]
    with TestClient(app) as other:
        other.get("/api/profile")
        empty=turn(other,{},"check payment status")
        assert empty["choices"]==[] and empty["next_action"] is None

def linked(client,language="en-IN"):
    client.post("/api/recipients",json={"name":"Sample family","upi_id":"sample@demo"})
    response=client.post("/api/phone/connection",json={"phone":"+910000000000","language":language,"consent":True})
    assert response.status_code==200,response.text
    pair=response.json()
    assert len(pair["call_code"])==6 and not pair["phone_verified"] and not pair["live_payments"]
    state=client.post("/api/phone/calls",json={}).json()
    for key in pair["call_code"]+"#":state=keyed(client,state,key)
    assert state["step"]=="main"
    return pair,state

def keyed(client,state,key,event_id=None):
    response=client.post("/api/phone/calls/key",json={"session_id":state["session_id"],"key":key,"event_id":event_id or str(uuid4())})
    assert response.status_code==200,response.text
    return response.json()

def payment_keys(client,state,amount="10000",purpose="1"):
    state=keyed(client,state,"1");assert state["step"]=="recipient"
    state=keyed(client,state,"1");assert state["step"]=="amount"
    for key in amount+"#":state=keyed(client,state,key)
    if state["step"]=="purpose":state=keyed(client,state,purpose)
    return state

@pytest.mark.parametrize("language",["en-IN","hi-IN","kn-IN"])
def test_phone_cap_readback_shared_receipt_and_retry(client,language):
    _,state=linked(client,language)
    state=payment_keys(client,state)
    assert state["step"]=="review" and "10000" in state["reply"]
    assert client.get("/api/demo-payments/history").json()==[]
    event_id=str(uuid4());before=state
    state=keyed(client,state,"1",event_id)
    assert state["step"]=="done" and state["receipt_id"]
    assert keyed(client,before,"1",event_id)==state
    conflict=client.post("/api/phone/calls/key",json={"session_id":state["session_id"],"key":"2","event_id":event_id})
    assert conflict.status_code==409
    receipts=client.get("/api/demo-payments/history").json()
    assert len(receipts)==1 and receipts[0]["id"]==state["receipt_id"] and receipts[0]["demo_mode"]

@pytest.mark.parametrize("amount",["10001","0","999999"])
def test_phone_over_limit_never_advances(client,amount):
    _,state=linked(client)
    state=payment_keys(client,state,amount)
    assert state["step"]=="amount"
    assert client.get("/api/demo-payments/history").json()==[]

def test_phone_scam_and_cancel_no_payment(client):
    _,state=linked(client)
    state=payment_keys(client,state,"500","4")
    assert state["step"]=="warning" and state["next_action"]=="/help/fraud"
    state=keyed(client,state,"1");assert state["step"]=="warning"
    state=keyed(client,state,"*");assert state["end_call"]
    state=keyed(client,state,"1");assert state["end_call"]
    assert client.get("/api/demo-payments/history").json()==[]

def test_phone_second_task_and_pending_block(client):
    _,state=linked(client)
    state=payment_keys(client,state,"100")
    first=keyed(client,state,"1")
    state=keyed(client,first,"0")
    assert state["receipt_id"] is None
    state=payment_keys(client,state,"200")
    assert state["receipt_id"] is None
    second=keyed(client,state,"1")
    assert first["receipt_id"]!=second["receipt_id"]
    client.post("/api/demo-payments",json=confirmed_attempt(client,value=client.post("/api/payments/review",json={"recipient":"Sample family","amount":"500","purpose":"Groceries"}).json(),outcome="pending"))
    state=keyed(client,second,"0")
    state=payment_keys(client,state,"500")
    state=keyed(client,state,"1")
    assert state["step"]=="paused" and state["receipt_id"]
    assert len(client.get("/api/demo-payments/history").json())==3

def test_link_ownership_auth_buffer_and_revocation(client):
    pair,state=linked(client)
    profile_id=client.get("/api/profile").json()["id"]
    with database() as db:
        data=json.dumps(list_records(db,profile_id,"phone_call"))
        assert pair["call_code"] not in data
    public=client.get("/api/phone/connection").json()
    assert "call_code" not in public and "code_hash" not in public
    exported=client.get("/api/profile/export").text
    assert pair["call_code"] not in exported
    assert client.get("/api/profile/export").json()["phone_connection"][0]["phone"]==pair["phone"]
    assert "code_hash" not in exported and "salt" not in exported
    with TestClient(app) as other:
        other.get("/api/profile")
        assert other.post("/api/phone/calls/key",json={"session_id":state["session_id"],"key":"1"}).status_code==404
        assert other.get("/api/phone/connection").json() is None
        assert other.post("/api/phone/connection",json={"phone":pair["phone"],"language":"en-IN","consent":True}).status_code==409
    assert client.delete("/api/phone/connection").status_code==200
    assert client.post("/api/phone/calls/key",json={"session_id":state["session_id"],"key":"1"}).status_code==404

def test_incorrect_call_code_is_rate_limited(client):
    client.post("/api/phone/connection",json={"phone":"+910000000000","consent":True})
    state=client.post("/api/phone/calls",json={}).json()
    for _ in range(5):
        for key in "#":state=keyed(client,state,key)
    assert state["step"]=="locked" and state["end_call"]

def signed(client,body,secret,stamp=None,signature=None):
    stamp=stamp or str(int(time.time()));raw=json.dumps(body,separators=(",",":")).encode()
    signature=signature or hmac.new(secret.encode(),stamp.encode()+b"."+raw,hashlib.sha256).hexdigest()
    return client.post("/api/phone/gateway",content=raw,headers={"content-type":"application/json","x-call-timestamp":stamp,"x-call-signature":signature})

def test_gateway_requires_signature_timestamp_and_call_auth(client,monkeypatch):
    pair,_=linked(client)
    body={"call_id":"provider_call_1","event_id":str(uuid4()),"caller":pair["phone"],"event":"start"}
    monkeypatch.delenv("TELEPHONY_WEBHOOK_SECRET",raising=False)
    assert signed(client,body,"x"*32).status_code==503
    secret="test-gateway-secret-"+"x"*32;monkeypatch.setenv("TELEPHONY_WEBHOOK_SECRET",secret)
    assert signed(client,body,secret,signature="forged").status_code==401
    assert signed(client,body,secret,stamp=str(int(time.time())-600)).status_code==401
    assert signed(client,body,secret,stamp="9"*100).status_code==401
    started=signed(client,body,secret).json();assert started["step"]=="auth"
    assert signed(client,body,secret).json()["session_id"]==started["session_id"]
    for key in pair["call_code"]+"#":
        reply=signed(client,{**body,"event_id":str(uuid4()),"event":"key","key":key},secret)
        assert reply.status_code==200,reply.text
    assert reply.json()["step"]=="main"
    assert client.get("/api/demo-payments/history").json()==[]

def test_fraud_prefill_immediate_save_owned_evidence_and_no_submission(client):
    payment=client.post("/api/demo-payments",json=confirmed_attempt(client)).json()
    response=client.post("/api/fraud/sessions",json={"payment_id":payment["id"],"language":"kn-IN"})
    assert response.status_code==200,response.text
    state=response.json();incident=state["incident"]
    assert incident["amount"]==payment["amount"] and incident["reference"]==payment["id"]
    assert incident["evidence"]["events"]==payment["events"]
    assert incident["status"]=="draft_not_submitted" and state["official_submission"]=="not_submitted"
    assert "simulated" in incident["summary"] and "No real money" in incident["summary"]
    assert len(client.get("/api/incidents").json())==1
    assert client.post("/api/fraud/sessions",json={"payment_id":payment["id"]}).json()["session_id"]==state["session_id"]
    with TestClient(app) as other:
        other.get("/api/profile")
        assert other.post("/api/fraud/sessions",json={"payment_id":payment["id"]}).status_code==404
        assert other.post("/api/fraud/chat",json={"session_id":state["session_id"],"message":"caller","language":"kn-IN"}).status_code==410

@pytest.mark.parametrize("language,description,method,amount,when",[
 ("en-IN","A caller told me to send money to protect my account","Call","no payment","Today morning"),
 ("hi-IN","फोन पर पैसे भेजने को कहा","कॉल","पता नहीं","आज सुबह"),
 ("kn-IN","ಬ್ಯಾಂಕ್ ಹೆಸರಿನಲ್ಲಿ ಕರೆ ಮಾಡಿ ಹಣ ಕೇಳಿದರು","ಕರೆ","ಐನೂರು","ಇಂದು ಬೆಳಿಗ್ಗೆ")])
def test_fraud_dynamic_questions_retry_ack_and_delete(client,language,description,method,amount,when):
    state=client.post("/api/fraud/sessions",json={"language":language}).json()
    answers = [(description,"method"),(method,"amount"),(amount,"when" if amount=="no payment" else "reference")]
    if amount != "no payment":
        answers += [("unknown","bank"),("Demo bank","when")]
    answers.append((when,"ready"))
    for text,step in answers:
        body={"session_id":state["session_id"],"request_id":str(uuid4()),"message":text,"language":language}
        response=client.post("/api/fraud/chat",json=body);assert response.status_code==200,response.text
        state=response.json();assert state["step"]==step
        assert client.post("/api/fraud/chat",json=body).json()==state
    assert len(client.get("/api/incidents").json())==1
    ack=client.post("/api/fraud/incidents/"+state["incident"]["id"]+"/acknowledgement",json={"reference":"DEMO-REF-123"}).json()
    assert not ack["acknowledgement"]["verified"] and ack["status"]=="draft_not_submitted"
    assert "User-entered acknowledgement (unverified): DEMO-REF-123" in ack["summary"]
    saved=client.get("/api/fraud/sessions/"+state["session_id"]).json()
    assert saved["incident"]["acknowledgement"]["reference"]=="DEMO-REF-123"
    assert client.get("/api/demo-payments/history").json()==[]
    client.delete("/api/incidents/"+state["incident"]["id"])
    assert client.get("/api/incidents").json()==[]
    assert client.post("/api/fraud/chat",json={"session_id":state["session_id"],"message":"another note"}).status_code==410

def test_fraud_rejects_private_secrets_before_save(client):
    state=client.post("/api/fraud/sessions",json={}).json()
    response=client.post("/api/fraud/chat",json={"session_id":state["session_id"],"message":"OTP is 123456"})
    assert response.status_code==422 and "123456" not in response.text
    assert client.get("/api/incidents").json()[0]["description"]==""

def test_readback_repeat_and_no_choose_correction(client):
    state=turn(client,{},"Send 500 to Ramesh for groceries")
    repeated=turn(client,state,"repeat")
    assert "500.00" in repeated["reply"] and "Ramesh" in repeated["reply"]
    state=turn(client,repeated,"no")
    assert state["step"]=="correction" and len(state["choices"])==3
    state=turn(client,state,state["choices"][0]["value"])
    assert state["step"]=="recipient" and state["slots"]["amount"]=="500.00"
    state=turn(client,state,"Lakshmi")
    assert "Lakshmi" in state["reply"] and not state["intent_confirmed"]

def test_cancelled_bill_requires_new_details(client):
    state=turn(client,{},"Pay Karnataka electricity bill 12345678")
    old=state["bill"]["id"]
    state=turn(client,state,"cancel")
    state=turn(client,state,"Pay electricity bill")
    assert state["step"]=="provider" and state["bill"] is None
    state=turn(client,state,"City 99999999")
    assert state["bill"]["id"]!=old and state["bill"]["consumer_number"]=="99999999"

def test_gateway_rejects_expired_profile(client,monkeypatch):
    pair,_=linked(client)
    profile_id=client.get("/api/profile").json()["id"]
    with database() as db:
        db.execute("UPDATE profiles SET expires=? WHERE id=?",(time.time()-1,profile_id))
    secret="test-gateway-"+"s"*32;monkeypatch.setenv("TELEPHONY_WEBHOOK_SECRET",secret)
    response=signed(client,{"call_id":"expired_profile","event_id":str(uuid4()),"caller":pair["phone"],"event":"start"},secret)
    assert response.status_code==404

@pytest.mark.parametrize("language,message",[("en-IN","I need scam help"),("hi-IN","मुझे धोखाधड़ी की मदद चाहिए"),("kn-IN","ನನಗೆ ವಂಚನೆ ಸಹಾಯ ಬೇಕು")])
def test_plain_scam_help_has_reporting_action(client,language,message):
    state=turn(client,{},message,language)
    assert state["intent"]=="scam_help" and state["next_action"].startswith("/help/fraud?conversation=")
    assert state["summary"] is None

def test_reporting_prefills_owned_conversation_for_review_not_loss(client):
    original="A demo bank caller asked me to move 5000 to a safe account"
    state=turn(client,{},original)
    body={"conversation_id":state["session_id"],"language":"en-IN"}
    report=client.post("/api/fraud/sessions",json=body)
    assert report.status_code==200,report.text
    report=report.json()
    assert original in report["incident"]["conversation_context"]
    assert report["incident"]["amount"]=="" and report["incident"]["description"]==""
    assert report["official_submission"]=="not_submitted"
    assert client.post("/api/fraud/sessions",json=body).json()["session_id"]==report["session_id"]
    with TestClient(app) as other:
        other.get("/api/profile")
        assert other.post("/api/fraud/sessions",json=body).status_code==404

