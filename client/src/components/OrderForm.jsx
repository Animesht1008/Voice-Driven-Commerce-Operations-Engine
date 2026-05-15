import { useState } from "react";

const initialForm = {
  name: "",
  phone: "",
  product: "",
  amount: "",
  address: "",
  language: "en",
};

// Format phone to E.164 format (e.g., +919876543210)
const formatPhoneE164 = (phone) => {
  const cleaned = String(phone).trim().replace(/[^\d+]/g, "");
  // If already starts with +, return as is
  if (cleaned.startsWith("+")) return cleaned;
  // If starts with country code without +, add +
  if (cleaned.length >= 10) return "+" + cleaned;
  // Otherwise add +91 (India) as default
  return "+91" + cleaned;
};

function OrderForm({ onSubmit, loading }) {
  const [form, setForm] = useState(initialForm);
  const [phoneError, setPhoneError] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    
    // Validate phone format on change
    if (name === "phone") {
      const formatted = formatPhoneE164(value);
      if (formatted.length < 11 || formatted.length > 15) {
        setPhoneError("Phone must be 10-14 digits (will be formatted as +XXX...");
      } else {
        setPhoneError("");
      }
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    
    // Format phone before submitting
    const formattedPhone = formatPhoneE164(form.phone);
    const E164_REGEX = /^\+[1-9]\d{9,14}$/;
    
    if (!E164_REGEX.test(formattedPhone)) {
      setPhoneError("Invalid phone number format. Use 10-14 digits.");
      return;
    }
    
    await onSubmit({ ...form, phone: formattedPhone });
    setForm(initialForm);
    setPhoneError("");
  };

  return (
    <form className="card form" onSubmit={submit}>
      <h2>Create COD Order</h2>
      <label>
        Name <input required name="name" value={form.name} onChange={handleChange} />
      </label>
      <label>
        Phone <input required name="phone" placeholder="+919876543210 (or 9876543210)" value={form.phone} onChange={handleChange} />
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
