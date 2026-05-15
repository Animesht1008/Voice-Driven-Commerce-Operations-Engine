import { useState } from "react";

const initialForm = {
  name: "",
  phone: "",
  product: "",
  amount: "",
  address: "",
  language: "en",
};

const PHONE_REGEX = /^\+91\d{10}$/;

function OrderForm({ onSubmit, loading }) {
  const [form, setForm] = useState(initialForm);
  const [phoneError, setPhoneError] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));

    if (name === "phone") {
      const trimmed = String(value).trim();
      if (!trimmed.startsWith("+")) {
        setPhoneError("Use country code in contact no. eg: +91XXXXXXXXXX");
      } else if (!PHONE_REGEX.test(trimmed)) {
        setPhoneError("Phone must be in +91XXXXXXXXXX format.");
      } else {
        setPhoneError("");
      }
    }
  };

  const submit = async (event) => {
    event.preventDefault();

    const phone = String(form.phone).trim();
    if (!PHONE_REGEX.test(phone)) {
      setPhoneError("Use country code in contact no. eg: +91XXXXXXXXXX");
      return;
    }

    await onSubmit({ ...form, phone });
    setForm(initialForm);
    setPhoneError("");
  };

  return (
    <form className="card form" onSubmit={submit}>
      <h2>📝 Create COD Order</h2>
      <label>
        Name <input required name="name" value={form.name} onChange={handleChange} />
      </label>
      <label>
        Phone <input required name="phone" placeholder="+91XXXXXXXXXX" value={form.phone} onChange={handleChange} />
        {phoneError && <small style={{ color: "red", display: "block", marginTop: "4px" }}>{phoneError}</small>}
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
