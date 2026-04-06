import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>Track Your Traffic</h1>
        <p className={styles.text}>
          UTM attribution and traffic analytics for your Shopify store. Know exactly where your visitors come from.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" />
              <span>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>UTM Campaign Tracking</strong>. Track every UTM-tagged campaign and see exactly how many visits each one generates.
          </li>
          <li>
            <strong>Traffic Source Breakdown</strong>. See which channels — organic search, paid ads, social, email, and more — are driving your store traffic.
          </li>
          <li>
            <strong>Device &amp; Country Insights</strong>. Understand whether your visitors are on mobile or desktop, and where they are in the world.
          </li>
        </ul>
      </div>
    </div>
  );
}
