"use client";

import { useState } from "react";

import { saveNotificationPreferences } from "@/app/actions/notification-preferences";

type InitialValues = {
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  notifyTopUp: boolean;
  notifyPurchase: boolean;
  notifyPreOrder: boolean;
  notifyPickup: boolean;
  notifyRefund: boolean;
  notifyLowBalance: boolean;
  lowBalanceThreshold: string;
};

export default function NotificationPreferencesForm({
  initialValues,
}: {
  initialValues: InitialValues;
}) {
  const [
    notifyLowBalance,
    setNotifyLowBalance,
  ] = useState(
    initialValues.notifyLowBalance,
  );

  return (
    <form
      action={saveNotificationPreferences}
      className="panel form"
    >
      <h2>Delivery channels</h2>

      <label>
        <input
          type="checkbox"
          name="emailEnabled"
          defaultChecked={
            initialValues.emailEnabled
          }
        />{" "}
        Email
      </label>

      <label>
        <input
          type="checkbox"
          name="smsEnabled"
          defaultChecked={
            initialValues.smsEnabled
          }
        />{" "}
        SMS
      </label>

      <label>
        <input
          type="checkbox"
          name="pushEnabled"
          defaultChecked={
            initialValues.pushEnabled
          }
        />{" "}
        App push notifications (future mobile app)
      </label>

      <div className="divider" />

      <h2>Events</h2>

      <label>
        <input
          type="checkbox"
          name="notifyTopUp"
          defaultChecked={
            initialValues.notifyTopUp
          }
        />{" "}
        Top-up requests and confirmations
      </label>

      <label>
        <input
          type="checkbox"
          name="notifyPurchase"
          defaultChecked={
            initialValues.notifyPurchase
          }
        />{" "}
        Canteen purchases
      </label>

      <label>
        <input
          type="checkbox"
          name="notifyPreOrder"
          defaultChecked={
            initialValues.notifyPreOrder
          }
        />{" "}
        Pre-order confirmations and ready notices
      </label>

      <label>
        <input
          type="checkbox"
          name="notifyPickup"
          defaultChecked={
            initialValues.notifyPickup
          }
        />{" "}
        Pre-order picked up
      </label>

      <label>
        <input
          type="checkbox"
          name="notifyRefund"
          defaultChecked={
            initialValues.notifyRefund
          }
        />{" "}
        Refunds and cancellations
      </label>

      <label>
        <input
          type="checkbox"
          name="notifyLowBalance"
          checked={notifyLowBalance}
          onChange={(event) =>
            setNotifyLowBalance(
              event.target.checked,
            )
          }
        />{" "}
        Low family-wallet balance
      </label>

      {notifyLowBalance && (
        <label className="label">
          Low balance alert amount (AUD)

          <input
            className="input"
            name="lowBalanceThreshold"
            type="number"
            min="0"
            max="1000"
            step="0.01"
            defaultValue={
              initialValues.lowBalanceThreshold
            }
          />
        </label>
      )}

      <button
        className="primary"
        type="submit"
      >
        Save Preferences
      </button>
    </form>
  );
}
