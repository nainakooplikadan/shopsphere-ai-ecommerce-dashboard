# 🛍️ ShopSphere – AI E-Commerce Dashboard

A modern, responsive e-commerce dashboard built with React and JavaScript, featuring live product data, product discovery, and a persistent shopping cart.

## 🚀 Live Demo
Coming Soon

## ✨ Features

- **Live Product Data:** Fetches products from the DummyJSON public API.
- **Product Search:** Search products by title.
- **Category Filtering:** Filter products by category.
- **Sorting:** Sort by price (low to high / high to low) and customer rating.
- **Dashboard Analytics:** Displays visible product count, average price, and average rating.
- **Shopping Cart:** Add, remove, increment, and decrement product quantities.
- **Cart Persistence:** Saves cart data in browser localStorage.
- **Responsive UI:** Designed for desktop and mobile screens.
- **Error Handling:** Loading, empty, retry, timeout, and API error states.
- **Image Fallbacks:** Handles unavailable product images gracefully.

## 🛠️ Tech Stack

- React.js
- JavaScript (ES6+)
- Vite
- HTML5
- CSS3
- Fetch API
- Browser localStorage
- DummyJSON API

## 🌐 API Integration

Product data is fetched from:

https://dummyjson.com/products?limit=24

No API key required.

## 📂 Project Structure

```text
shopsphere/
├── public/
├── src/
│   ├── assets/
│   ├── App.jsx
│   ├── App.css
│   ├── index.css
│   └── main.jsx
├── index.html
├── package.json
└── vite.config.js
```

## ⚙️ Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/nainakooplikadan/shopsphere-ai-ecommerce-dashboard.git
```

### 2. Navigate to the project

```bash
cd shopsphere-ai-ecommerce-dashboard
```

### 3. Install dependencies

```bash
npm install
```

### 4. Start the development server

```bash
npm run dev
```

### 5. Build for production

```bash
npm run build
```

## 🛒 Cart Functionality

- Add products to cart.
- Increase or decrease quantities.
- Remove individual products.
- Clear the entire cart.
- Automatically calculate subtotal.
- Persist cart contents using localStorage.

Cart data is stored locally in the browser and is not synchronized across devices.

## ⚠️ Notes

- Product information is retrieved from the public DummyJSON API.
- Prices are displayed in USD for demonstration purposes.
- Only the loaded product subset is searchable and filterable.
- This is a frontend demonstration project. It does not include authentication, payments, or checkout.

## 👩‍💻 Author

**Naina Kooplikadan**

- GitHub: https://github.com/nainakooplikadan

---

⭐ If you find this project interesting, feel free to explore the repository!
