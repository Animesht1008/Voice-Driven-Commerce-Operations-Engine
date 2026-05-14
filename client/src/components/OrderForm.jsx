import { useState } from "react";

const initialForm = {
  name: "",
  phone: "",
  product: "",
  amount: "",
  address: "",
  language: "en",
};

function OrderForm({ onSubmit, loading }) {
  const [form, setForm] = useState(initialForm);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    await onSubmit(form);
    setForm(initialForm);
  };

  return (
    <form className="card form" onSubmit={submit}>
      <h2>Create COD Order</h2>
      <label>
        Name <input required name="name" value={form.name} onChange={handleChange} />
      </label>
      <label>
        Phone <input required name="phone" value={form.phone} onChange={handleChange} />
      </label>
      <label>
        Product <input required name="product" value={form.product} onChange={handleChange} />
      </label>
      <label>
        Amount (INR){" "}
        <input required type="number" min="1" name="amount" value={form.amount} onChange={handleChange} />
      </label>
      <label>
        Address <textarea required name="address" value={form.address} onChange={handleChange} />
      </label>
      <div className="lang-toggle">
        <label>
          <input type="radio" name="language" value="en" checked={form.language === "en"} onChange={handleChange} />{" "}
          English
        </label>
        <label>
          <input type="radio" name="language" value="hi" checked={form.language === "hi"} onChange={handleChange} />{" "}
          Hindi
        </label>
      </div>
      <button disabled={loading} type="submit">
        {loading ? "Placing..." : "Place Order"}
      </button>
    </form>
  );
}

export default OrderForm;
