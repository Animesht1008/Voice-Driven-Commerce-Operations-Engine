import { useState } from "react";
import OrderForm from "../components/OrderForm";
import { createOrder } from "../services/api";

function CreateOrderPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const submitOrder = async (form) => {
    try {
      setLoading(true);
      await createOrder(form);
      setMessage("Order placed. Confirmation call has been triggered.");
    } catch (error) {
      setMessage(error?.response?.data?.error || "Failed to create order.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <section className="card intro-card">
        <h2>Voice Workflow Automation</h2>
        <p>The system is designed around workflow automation instead of chatbot interaction.</p>
      </section>
      <OrderForm onSubmit={submitOrder} loading={loading} />
      {message && <p className="flash">{message}</p>}
    </>
  );
}

export default CreateOrderPage;
