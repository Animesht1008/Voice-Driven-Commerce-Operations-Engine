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
      setMessage("Order placed. Confirmation call workflow started.");
    } catch (error) {
      setMessage(error?.response?.data?.error || "Failed to create order.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <section className="card intro-card">
        <h2>📥 COD Form Dashboard</h2>
        <p>Please create a new COD order and trigger voice confirmation.</p>
      </section>
      <OrderForm onSubmit={submitOrder} loading={loading} />
      {message && <p className="flash">{message}</p>}
    </>
  );
}

export default CreateOrderPage;
