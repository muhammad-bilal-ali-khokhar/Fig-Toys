"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { HelpSidebar } from "@/components/help/help-sidebar";
import { HelpIcon, MailIcon, PhoneIcon } from "@/components/icons";
import { DEVELOPER, HELP_SECTIONS, type HelpSectionId } from "@/lib/constants";

type GroupProps = { children: React.ReactNode };

function Group({ children }: GroupProps) {
  return <div className="divide-y divide-ink-100 overflow-hidden rounded-2xl bg-white">{children}</div>;
}

function SectionTitle({ children }: GroupProps) {
  return (
    <h3 className="mb-2 mt-6 px-1 text-xs font-semibold uppercase tracking-wide text-ink-400 first:mt-0">
      {children}
    </h3>
  );
}

function Heading({ children }: GroupProps) {
  return <h4 className="px-4 pb-1 pt-4 text-sm font-semibold text-ink-900">{children}</h4>;
}

function Body({ children }: GroupProps) {
  return <p className="px-4 pb-2 text-sm leading-relaxed text-ink-600">{children}</p>;
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 px-4 pb-4">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm leading-relaxed text-ink-600">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Note({ children }: GroupProps) {
  return <p className="mx-4 mb-4 rounded-xl bg-brand-50 px-4 py-3 text-sm leading-relaxed text-brand-700">{children}</p>;
}

function ContactRow({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string; href?: string }) {
  const content = (
    <span className="flex items-center gap-3 px-4 py-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-ink-400">{label}</span>
        <span className="block truncate text-sm font-medium text-ink-900">{value}</span>
      </span>
    </span>
  );
  if (!href) return content;
  return (
    <a href={href} className="block transition hover:bg-ink-50">
      {content}
    </a>
  );
}

export default function HelpPage() {
  const searchParams = useSearchParams();
  const requested = searchParams.get("section");
  const valid = HELP_SECTIONS.some((s) => s.id === requested);
  const [section, setSection] = useState<HelpSectionId>(valid ? (requested as HelpSectionId) : "getting-started");
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [section]);

  return (
    <div className="flex h-full gap-6">
      <HelpSidebar activeSection={section} onSectionClick={setSection} />

      <main ref={mainRef} className="min-w-0 flex-1 overflow-y-auto overscroll-none px-7 pb-6">
        {section === "getting-started" && (
          <>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-ink-900">Getting started</h2>
              <p className="text-sm text-ink-500">
                Everything you need to set up your shop, sign in and understand how roles work.
              </p>
            </div>

            <SectionTitle>Signing in</SectionTitle>
            <Group>
              <Heading>Your staff account</Heading>
              <Body>
                Fig POS uses preregistered staff accounts only. There is no public sign-up screen, so only the store
                owner or an Admin can create accounts. Each account has a name, a role and a 4-digit PIN that is used
                to sign in.
              </Body>
              <Body>
                When your Admin creates your account, they will share your PIN with you. Keep it private and do not
                write it down near the machine.
              </Body>
              <Heading>Signing in with your PIN</Heading>
              <Bullets
                items={[
                  "Open Fig POS and wait for it to load.",
                  "Enter your 4-digit PIN on the login screen.",
                  "You will be taken to the Dashboard for your role.",
                ]}
              />
              <Heading>Changing your PIN</Heading>
              <Body>
                Open Settings and go to Preferences, then choose Change PIN. You will need to enter your current PIN
                and the new 4-digit PIN you want to use. This is useful if you think someone else learned your PIN.
              </Body>
            </Group>

            <SectionTitle>Roles & permissions</SectionTitle>
            <Group>
              <Heading>Admin</Heading>
              <Body>
                The Admin has full access to everything. This includes managing staff and roles, changing company
                settings, seeing costs and profit, creating and restoring backups, and viewing the activity log.
              </Body>
              <Heading>Manager</Heading>
              <Body>
                A Manager can handle the day to day running of the shop: sales, stock, purchases, contacts and most
                reports. A Manager cannot change company settings or manage other users' roles.
              </Body>
              <Heading>Cashier</Heading>
              <Body>
                A Cashier works at the counter and processes sales. To keep things simple, cost prices and profit
                figures are hidden from Cashiers. They see only the information needed to make a sale.
              </Body>
              <Note>
                Your role decides what you can see and do. If a button or screen is missing, your role may not allow
                it. Ask your Admin if you believe you should have access.
              </Note>
            </Group>

            <SectionTitle>First-time setup</SectionTitle>
            <Group>
              <Heading>Shop details</Heading>
              <Body>
                Open Settings and go to Shop details to enter your store name, logo, address, phone number, WhatsApp
                number, email and website. These details are printed on receipts, reservation slips and other
                documents, so it is worth entering them correctly.
              </Body>
              <Heading>Financial settings</Heading>
              <Body>
                Still in Settings, the Financial tab lets you pick your currency (PKR by default), set your tax rate
                and configure the card fee charged on card payments. Your tax rate is applied automatically when you
                create invoices.
              </Body>
              <Heading>Bank accounts</Heading>
              <Body>
                Add your bank accounts under Settings, then Bank accounts. When you do this, transfer details can be
                printed on invoices so customers know exactly where to send money.
              </Body>
              <Heading>Receipt preferences</Heading>
              <Body>
                In Settings, Preferences, you can set your timezone and type a receipt footer message that appears at
                the bottom of every receipt.
              </Body>
              <Heading>Sounds & theme</Heading>
              <Body>
                The Sounds tab lets you turn feedback sounds on or off, and the Theme tab lets you pick the colour style
                for the whole app.
              </Body>
            </Group>
          </>
        )}

        {section === "dashboard" && (
          <>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-ink-900">Dashboard</h2>
              <p className="text-sm text-ink-500">Your at-a-glance overview of how the shop is doing.</p>
            </div>
            <Group>
              <Heading>What you see</Heading>
              <Body>
                The Dashboard is the first screen you land on after signing in. It brings together the key figures for
                your shop, such as today's sales, outstanding credit and important alerts, so you can see at a glance
                how the business is doing without opening individual reports. Everything is updated live from your data.
              </Body>
              <Heading>Reading the numbers</Heading>
              <Bullets
                items={[
                  "Today's sales: the total value of what you have sold so far today.",
                  "Outstanding credit: money customers still owe you from credit sales.",
                  "Stock alerts: warnings about low stock or units you should look at.",
                  "Recent activity: a quick look at the latest sales, purchases and payments.",
                ]}
              />
              <Heading>Compact prices</Heading>
              <Body>
                Large amounts can be shown in a compact form, for example 375k instead of 375,000, to keep the screen
                clean and readable. You can turn this on or off in Settings, under Financial, using the Show compact
                prices option.
              </Body>
              <Heading>Where the numbers come from</Heading>
              <Body>
                Everything on the Dashboard is calculated from your live data: your sales, purchases, expenses and
                credit records. As you record transactions throughout the day, the Dashboard updates to reflect them, so
                what you see is always current.
              </Body>
              <Heading>Using it well</Heading>
              <Bullets
                items={[
                  "Review the Dashboard at the start of each day to plan the day ahead.",
                  "Keep an eye on outstanding credit so balances do not get too large.",
                  "Use it to spot low stock and reorder before you run out.",
                  "Jump into Reports for the full detail behind any number.",
                ]}
              />
              <Note>
                Because the Dashboard is live, make sure your sales, expenses and payments are recorded as they happen.
                Only then is the overview accurate.
              </Note>
            </Group>
          </>
        )}

        {section === "sales" && (
          <>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-ink-900">Sales & POS</h2>
              <p className="text-sm text-ink-500">How to sell at the counter, step by step.</p>
            </div>
            <SectionTitle>The POS screen</SectionTitle>
            <Group>
              <Heading>Sale Invoice</Heading>
              <Body>
                This is the counter screen where you make sales. Search for a phone by name or scan it by IMEI. New and
                used devices are shown separately so you always know what you are selling.
              </Body>
              <Heading>Creating a sale</Heading>
              <Bullets
                items={[
                  "Start typing in the search box, or use a scanner to find a unit by IMEI.",
                  "Tap the unit to add it to the invoice.",
                  "Apply any discounts or switch to a credit sale for a customer.",
                  "Choose how the customer pays: cash, card or bank transfer.",
                  "Confirm the invoice to print a receipt and update your stock automatically.",
                ]}
              />
              <Heading>After you finalize</Heading>
              <Body>
                Once the sale is saved, the unit leaves inventory and the sale appears in your reports. The receipt can
                be printed or re-printed later if needed.
              </Body>
            </Group>
            <SectionTitle>Payments</SectionTitle>
            <Group>
              <Heading>Payment methods</Heading>
              <Body>
                A sale can be paid by cash, card or bank transfer. If you charge a card fee, it is calculated
                automatically based on your settings. For credit sales, the amount owed is tracked against the
                customer's contact.
              </Body>
              <Note>
                Sales, purchases and returns all use one unified transaction system, so your records always stay
                consistent.
              </Note>
            </Group>
          </>
        )}

        {section === "stock" && (
          <>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-ink-900">Stock & inventory</h2>
              <p className="text-sm text-ink-500">Track every phone by IMEI, new or used.</p>
            </div>
            <Group>
              <Heading>Units and IMEI</Heading>
              <Body>
                Every physical phone is a single unit tracked by its IMEI number. The IMEI is the unique identifier of
                each mobile device, so there is never any confusion about which exact phone you have, whether it is new
                or used. You can search for any unit by its IMEI.
              </Body>
              <Heading>The Inventory screen</Heading>
              <Body>
                Your full stock list lives here. It shows every unit, its condition (new or used), its IMEI and its
                current state: in stock, reserved or sold. Use the search and filters to find a specific device or to
                review everything you currently hold.
              </Body>
              <Heading>Unit states</Heading>
              <Bullets
                items={[
                  "In stock: available to sell right now.",
                  "Reserved: held for a customer and not available for sale.",
                  "Sold: already sold and out of inventory.",
                ]}
              />
              <Heading>Adding stock</Heading>
              <Body>
                Stock comes in through Purchases. When you record a purchase you choose the product and add the units
                and their IMEIs, and they appear in inventory automatically. Returns also restore units back to
                inventory so they can be sold again.
              </Body>
              <Heading>Moving stock out</Heading>
              <Body>
                Stock leaves inventory when you make a sale or a purchase return. A reservation marks a unit as held but
                does not remove it from your records, so you always know where each phone is.
              </Body>
              <Heading>Keeping stock accurate</Heading>
              <Bullets
                items={[
                  "Enter the correct IMEI for every unit when it arrives.",
                  "Record sales, returns and purchases promptly.",
                  "Use the inventory search to locate a unit before promising it to a customer.",
                  "Check low-stock alerts on the Dashboard so you can reorder in time.",
                ]}
              />
              <Note>
                New and used phones are shown separately in the buying and selling screens, but each unit carries one
                unified condition field. This keeps the data clean while making the shop experience clear.
              </Note>
            </Group>
          </>
        )}

        {section === "products" && (
          <>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-ink-900">Products</h2>
              <p className="text-sm text-ink-500">The templates behind your stock.</p>
            </div>
            <Group>
              <Heading>What a product is</Heading>
              <Body>
                A product is a template for a type of phone, such as a specific model and colour. It holds the details
                and price information, and individual physical phones are added to it as units. For example, one product
                might be a certain model in a certain colour, and every unit of that product is a real phone with its
                own IMEI.
              </Body>
              <Heading>Why products matter</Heading>
              <Body>
                Setting up your products well makes purchases and sales faster and keeps your records consistent. When
                buying stock you pick a product and then add its units. When selling, you search for the product and the
                available units come up for you to choose from.
              </Body>
              <Heading>New vs used</Heading>
              <Body>
                New and used phones are clearly separated in the buying and selling screens, but they are tracked under
                one unified condition field on each unit. This keeps the data simple while keeping the shop experience
                clear.
              </Body>
              <Heading>Setting up a product</Heading>
              <Bullets
                items={[
                  "Give the product a clear, consistent name that is easy to search for.",
                  "Set a sensible selling price and cost price so profit reports are correct.",
                  "Choose whether it is new or used, and any model and colour details.",
                  "Add units (with their IMEIs) when the phones arrive.",
                ]}
              />
              <Heading>Good product habits</Heading>
              <Bullets
                items={[
                  "Keep names consistent so search always finds the right phone.",
                  "Set prices and costs when you create a product, not later.",
                  "Review your product list regularly and tidy up anything unused.",
                  "Do not create a new product for every single phone: reuse the template and add units.",
                ]}
              />
              <Note>
                The key idea: products are the what, units are the which one. This separation is what lets Fig POS track
                every single phone by IMEI.
              </Note>
            </Group>
          </>
        )}

        {section === "purchases" && (
          <>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-ink-900">Purchases</h2>
              <p className="text-sm text-ink-500">Buying new stock and receiving it.</p>
            </div>
            <Group>
              <Heading>Recording a purchase</Heading>
              <Body>
                When you buy new stock, record it under Purchases. You select or create the product, enter how many
                units came in, and add each unit's IMEI. This brings the units into inventory automatically and records
                your cost, which is what makes profit reports possible.
              </Body>
              <Heading>The purchase flow</Heading>
              <Bullets
                items={[
                  "Choose the vendor (supplier) you are buying from.",
                  "Select or create the products being purchased.",
                  "Enter the quantity and each unit's IMEI for every phone.",
                  "Set the cost price and any tax.",
                  "Save the purchase to bring the stock into inventory.",
                ]}
              />
              <Heading>Purchase orders</Heading>
              <Body>
                Use Purchase orders to plan what you intend to buy from a supplier before it arrives. When the goods
                come in, you can turn the order into an actual purchase, which saves you re-entering the details and
                helps you keep track of what is on order.
              </Body>
              <Heading>Purchase returns</Heading>
              <Body>
                If you send stock back to a supplier, record a purchase return. This removes the units from your stock
                and keeps your records accurate, so your inventory and reports stay correct.
              </Body>
              <Heading>Staying accurate</Heading>
              <Bullets
                items={[
                  "Always enter the correct IMEI for each unit.",
                  "Record purchases as soon as the stock arrives.",
                  "Use purchase orders to keep track of stock that is still coming.",
                  "Record purchase returns promptly so inventory is not overstated.",
                ]}
              />
              <Note>
                Recording your cost on purchases is what makes profit reports possible. Only Admins and Managers see
                cost and profit figures.
              </Note>
            </Group>
          </>
        )}

        {section === "people" && (
          <>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-ink-900">Contacts & credit</h2>
              <p className="text-sm text-ink-500">One list for customers, vendors and walk-ins.</p>
            </div>
            <Group>
              <Heading>One unified contact list</Heading>
              <Body>
                Contacts is a single list used for customers, vendors and walk-ins. You do not need to manage three
                separate lists. Each contact is used wherever it applies: receipts, credit, reservations and vouchers.
              </Body>
              <Bullets
                items={[
                  "Customers buy from you and may buy on credit.",
                  "Vendors (suppliers) sell stock to you.",
                  "Walk-ins are quick, no-details-needed sales.",
                ]}
              />
              <Heading>Credit sales</Heading>
              <Body>
                When a customer buys on credit, the amount owed is tracked against their contact. You can see who owes
                you money in the reports and record payments as they come in, so you always know your outstanding
                balances.
              </Body>
              <Heading>Ledgers</Heading>
              <Body>
                Reports include customer and vendor ledgers, plus receivables (what customers owe you) and payables
                (what you owe vendors). The ageing report shows which balances are overdue.
              </Body>
            </Group>
          </>
        )}

        {section === "reservations" && (
          <>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-ink-900">Reservations & vouchers</h2>
              <p className="text-sm text-ink-500">Hold phones for customers and accept advance payments.</p>
            </div>
            <Group>
              <Heading>Reservations</Heading>
              <Body>
                Hold a phone for a customer with a reservation. The unit is marked as reserved and stays out of
                inventory until the customer comes to collect it, so you never accidentally sell a held phone. This is
                ideal when a customer has seen a specific device and wants time to pay or come back.
              </Body>
              <Heading>How a reservation works</Heading>
              <Bullets
                items={[
                  "Pick the unit and the customer it is being held for.",
                  "The unit is marked as reserved, so it cannot be sold.",
                  "When the customer returns, complete the sale as normal.",
                  "If the customer changes their mind, release the reservation and the unit goes back on sale.",
                ]}
              />
              <Heading>Vouchers</Heading>
              <Body>
                Sell prepaid vouchers that a customer can redeem later against a purchase. This is handy for gift cards
                or advance payments that are used at a later date. The value is held as a voucher balance until it is
                redeemed.
              </Body>
              <Heading>How vouchers work</Heading>
              <Bullets
                items={[
                  "Sell a voucher for a set amount to a customer.",
                  "The value is stored as a voucher balance.",
                  "When the customer buys, redeem the voucher against the sale.",
                  "Any remaining balance stays on the voucher for later.",
                ]}
              />
              <Heading>When to use each</Heading>
              <Body>
                Use a reservation when you are holding a specific phone. Use a voucher when the customer pays in advance
                without picking a specific device yet. You can also combine them, for example holding a phone while a
                customer pays for it with a voucher.
              </Body>
              <Note>
                Keep track of outstanding reservations and unredeemed vouchers so nothing is forgotten. The related
                reports help you see what is still open.
              </Note>
            </Group>
          </>
        )}

        {section === "money" && (
          <>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-ink-900">Money & expenses</h2>
              <p className="text-sm text-ink-500">Track cash, bank balances and your day to day costs.</p>
            </div>
            <Group>
              <Heading>Expenses</Heading>
              <Body>
                Record your day to day shop expenses, such as rent, electricity or repairs, so you can see your true
                costs alongside your income. Recording expenses regularly gives you an accurate picture of what running
                the shop really costs.
              </Body>
              <Heading>Recording an expense</Heading>
              <Bullets
                items={[
                  "Open Expenses and choose to add a new expense.",
                  "Pick the category, enter the amount and any details.",
                  "Choose how it was paid: cash or from a bank account.",
                  "Save it and it appears in your expense and money reports.",
                ]}
              />
              <Heading>Money & Bank</Heading>
              <Body>
                See cash movements and your bank account balances in one place. If you set a default bank account, it is
                used automatically when you record bank transactions, which keeps things quick and consistent.
              </Body>
              <Heading>Bank accounts</Heading>
              <Body>
                Manage your bank accounts under Settings, then Bank accounts. You can add accounts, set one as the
                default and print transfer details on receipts so customers know exactly where to send money.
              </Body>
              <Heading>Keeping money accurate</Heading>
              <Bullets
                items={[
                  "Record expenses and payments as they happen.",
                  "Mark which account or cash each transaction belongs to.",
                  "Reconcile your balances regularly against your real bank statements.",
                  "Review the Money & Bank report often to spot issues early.",
                ]}
              />
              <Note>
                All money is handled as exact decimal values, so your financial records stay accurate and free from
                rounding errors.
              </Note>
            </Group>
          </>
        )}

        {section === "reports" && (
          <>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-ink-900">Reports</h2>
              <p className="text-sm text-ink-500">Understand your shop's performance in detail.</p>
            </div>
            <Group>
              <Heading>Sales & purchases</Heading>
              <Body>
                View sales and purchase reports, plus their itemised lists, to review what has been bought and sold over
                any period.
              </Body>
              <Heading>Profit & money</Heading>
              <Body>
                Profit, cash and Money & Bank reports help you understand your margins and where cash is going.
              </Body>
              <Heading>Stock reports</Heading>
              <Body>
                Stock and stock movement reports show what you have and how units have moved in and out.
              </Body>
              <Heading>People reports</Heading>
              <Body>
                Customer and vendor ledgers, receivables, payables and the ageing report help you manage who owes you
                and who you owe.
              </Body>
              <Heading>Sale & purchase returns</Heading>
              <Body>
                Separate reports cover sale returns and purchase returns so you can review anything that came back.
              </Body>
              <Note>
                Reports that show costs and profit are only visible to Admins and Managers. A Cashier will not see
                profit figures.
              </Note>
            </Group>
          </>
        )}

        {section === "printing" && (
          <>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-ink-900">Printing</h2>
              <p className="text-sm text-ink-500">Receipts, slips and printed documents.</p>
            </div>
            <Group>
              <Heading>Print Studio</Heading>
              <Body>
                Use Print Studio to design and print receipts, slips and other documents. You control what appears on
                the receipt, such as bank account details, your logo and your footer message, so your printed documents
                look professional and carry the right information.
              </Body>
              <Heading>What you can customise</Heading>
              <Bullets
                items={[
                  "Your shop name, logo and contact details.",
                  "Which bank accounts are printed for transfer details.",
                  "Your receipt footer message.",
                  "The layout and what sections appear on the document.",
                ]}
              />
              <Heading>Print & thermal settings</Heading>
              <Body>
                Configure your thermal printer under Settings, then Print & thermal. Set the paper size and other
                printer options so your receipts come out correctly every time, without cutting off or wasting paper.
              </Body>
              <Heading>Getting receipts right</Heading>
              <Bullets
                items={[
                  "Make sure your shop details and logo are correct in Settings.",
                  "Choose which bank accounts appear on receipts in Print Studio.",
                  "Check your footer message prints the way you want.",
                  "Set the right paper size so nothing is cut off.",
                  "Print a test receipt after changing any settings.",
                ]}
              />
              <Note>
                If a receipt does not print, first check the printer is connected and the paper size is correct before
                changing anything else. See Troubleshooting for more help.
              </Note>
            </Group>
          </>
        )}

        {section === "settings" && (
          <>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-ink-900">Settings</h2>
              <p className="text-sm text-ink-500">Configure the app the way your shop needs.</p>
            </div>
            <Group>
              <Heading>Shop details</Heading>
              <Body>
                Store name, logo, address, phone, WhatsApp, email and website. These appear on receipts and printed
                documents, so it is worth entering them correctly when you first set up.
              </Body>
              <Heading>Preferences</Heading>
              <Body>
                Your timezone, receipt footer message and the option to change your PIN. The timezone makes sure times
                on receipts and reports match your local time.
              </Body>
              <Heading>Financial</Heading>
              <Body>
                Currency, tax rate, card fee and the compact prices display option. Your tax rate and card fee are
                applied automatically when you create invoices.
              </Body>
              <Heading>Bank accounts</Heading>
              <Body>
                Add and manage bank accounts, and set one as the default. Default accounts are used automatically and
                can be printed as transfer details on receipts.
              </Body>
              <Heading>Sounds & Theme</Heading>
              <Body>
                Turn feedback sounds on or off, and pick the colour style for the whole app. You can change these any
                time without affecting your data.
              </Body>
              <Heading>Users & roles</Heading>
              <Body>
                Manage staff accounts, their roles and permissions. Only an Admin can manage users, so keep your Admin
                PIN safe.
              </Body>
              <Heading>Activity Log</Heading>
              <Body>
                Review a history of important actions taken in the app. This helps you track who did what, which is
                useful for keeping the shop accountable.
              </Body>
              <Heading>Backup & restore</Heading>
              <Body>
                Create manual backups, restore from a backup and manage your data safety. This is where you protect your
                records.
              </Body>
              <Heading>Print & thermal</Heading>
              <Body>
                Configure your printer and paper settings so receipts print correctly.
              </Body>
              <Heading>Desktop app</Heading>
              <Body>
                Manage the desktop app itself, including crash reporting and diagnostics.
              </Body>
              <Note>
                Many Settings sections require Admin access. If a section is missing, your role may not allow you to
                change it.
              </Note>
            </Group>
          </>
        )}

        {section === "backup-data" && (
          <>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-ink-900">Backup & data</h2>
              <p className="text-sm text-ink-500">How your data is stored, backed up and kept safe.</p>
            </div>

            <SectionTitle>How data is stored</SectionTitle>
            <Group>
              <Heading>Your local database</Heading>
              <Body>
                Fig POS stores all your data in a local database on the machine where the app runs. This includes your
                products, units and IMEIs, purchases, sales, contacts, bank accounts and settings. Because it is local,
                your data is always available and never depends on an external service being online.
              </Body>
            </Group>

            <SectionTitle>Backing up</SectionTitle>
            <Group>
              <Heading>Automatic backups</Heading>
              <Body>
                Fig POS creates automatic backups so that a recent copy of your data is always available. This means
                even if something goes wrong, you can recover most of your data from the most recent automatic backup.
              </Body>
              <Heading>Manual backup</Heading>
              <Body>
                For extra safety, create a manual backup whenever you make big changes, or at least once a week. Open
                Settings, go to Backup & restore, and choose to create a backup file. Save that file somewhere safe and
                separate from the computer, such as a USB drive or cloud folder.
              </Body>
              <Bullets
                items={[
                  "Create a manual backup after major changes or at the end of each day.",
                  "Keep backups somewhere separate from the app's data folder.",
                  "Label backups with the date so you can tell them apart.",
                ]}
              />
              <Heading>Restoring a backup</Heading>
              <Body>
                If you ever need to recover your data, open Settings, go to Backup & restore and choose the backup file
                to restore from. The app will restore your data from that backup. Be aware that restoring will
                overwrite the current data with the version from the backup.
              </Body>
            </Group>

            <SectionTitle>Working offline</SectionTitle>
            <Group>
              <Heading>Offline mode</Heading>
              <Body>
                If the connection drops while you are using the app, you can keep working. The changes you make are
                saved locally and a bar appears at the top showing that some changes are pending sync.
              </Body>
              <Heading>Syncing when you reconnect</Heading>
              <Body>
                When the connection comes back, the pending changes sync automatically. You can also press Sync now to
                push them immediately. Until they sync, they stay safe on your machine.
              </Body>
            </Group>

            <SectionTitle>Data safety tips</SectionTitle>
            <Group>
              <Heading>Best practices</Heading>
              <Bullets
                items={[
                  "Do not delete the app's data folder manually.",
                  "Make regular manual backups in addition to the automatic ones.",
                  "Keep your PIN private so only authorised staff can sign in.",
                  "Restart the app regularly to keep it running smoothly.",
                  "Contact support before attempting any advanced recovery steps.",
                ]}
              />
            </Group>
          </>
        )}

        {section === "troubleshooting" && (
          <>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-ink-900">Troubleshooting</h2>
              <p className="text-sm text-ink-500">Common issues and the steps to try before contacting support.</p>
            </div>

            <SectionTitle>Signing in</SectionTitle>
            <Group>
              <Heading>Can't sign in</Heading>
              <Bullets
                items={[
                  "Double-check you are entering the correct 4-digit PIN.",
                  "Make sure the PIN is being entered on the right machine.",
                  "If you are locked out, ask your Admin to reset your PIN.",
                ]}
              />
              <Heading>Forgotten your PIN</Heading>
              <Body>
                Only an Admin can create or reset staff accounts. Ask your Admin to reset your PIN so you can sign in
                again. Never share your PIN with anyone.
              </Body>
            </Group>

            <SectionTitle>Starting the app</SectionTitle>
            <Group>
              <Heading>The app won't start</Heading>
              <Bullets
                items={[
                  "Close Fig POS completely and open it again.",
                  "Make sure the machine is not low on memory or storage.",
                  "If it still fails to start, contact support with a description of what happens.",
                ]}
              />
              <Heading>The app is slow</Heading>
              <Body>
                Restart the app to clear temporary memory. Make sure the machine is not running out of space. If
                performance stays poor, contact support.
              </Body>
            </Group>

            <SectionTitle>Missing features</SectionTitle>
            <Group>
              <Heading>Missing a report or screen</Heading>
              <Body>
                Some areas of the app are hidden based on your role. For example, Cashiers do not see cost and profit
                reports. If you believe you should see something that is missing, ask your Admin to check your role and
                permissions.
              </Body>
              <Heading>Missing stock or data</Heading>
              <Body>
                If you cannot find a unit or sale, check your filters. Reports and inventory screens let you filter by
                date, status and type. Clear your filters to see everything.
              </Body>
            </Group>

            <SectionTitle>Saving & syncing</SectionTitle>
            <Group>
              <Heading>Data not saving</Heading>
              <Bullets
                items={[
                  "Check that you are online and not in the middle of a pending sync.",
                  "Look for a warning bar at the top of the screen.",
                  "If an action failed, try it again once.",
                  "If it keeps failing, contact support.",
                ]}
              />
              <Heading>Changes not syncing</Heading>
              <Body>
                When you reconnect, pending changes sync automatically. If they still show as pending, press Sync now.
                If they never sync, contact support.
              </Body>
            </Group>

            <SectionTitle>Printing</SectionTitle>
            <Group>
              <Heading>Receipts not printing</Heading>
              <Bullets
                items={[
                  "Make sure the printer is connected and switched on.",
                  "Check the paper and paper size in Print & thermal settings.",
                  "Test with a simple receipt to isolate the problem.",
                  "If the printer is fine, review the layout in Print Studio.",
                ]}
              />
            </Group>

            <SectionTitle>Still stuck?</SectionTitle>
            <Group>
              <Heading>Contact support</Heading>
              <Body>
                If the steps above do not help, head to the Contact & support section of this Help page. Provide as much
                detail as you can, such as what you were doing when the problem happened, any error message you saw,
                and your app version. This helps the team solve it faster.
              </Body>
            </Group>
          </>
        )}

        {section === "contact-support" && (
          <>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-ink-900">Contact & support</h2>
              <p className="text-sm text-ink-500">Get in touch with the team that built Fig POS.</p>
            </div>

            <SectionTitle>Reach the team</SectionTitle>
            <Group>
              <ContactRow
                icon={<MailIcon className="h-4 w-4" />}
                label="Email"
                value={DEVELOPER.email}
                href={`mailto:${DEVELOPER.email}`}
              />
              <ContactRow icon={<PhoneIcon className="h-4 w-4" />} label="Phone" value={DEVELOPER.phone} />
              <ContactRow
                icon={<PhoneIcon className="h-4 w-4" />}
                label="WhatsApp"
                value={DEVELOPER.whatsapp}
                href={`https://wa.me/${DEVELOPER.whatsapp.replace(/[^0-9]/g, "")}`}
              />
              <ContactRow
                icon={<HelpIcon className="h-4 w-4" />}
                label="Website"
                value={DEVELOPER.website}
                href={DEVELOPER.website}
              />
              <ContactRow
                icon={<HelpIcon className="h-4 w-4" />}
                label="Website (PK)"
                value={DEVELOPER.websiteAlt}
                href={DEVELOPER.websiteAlt}
              />
            </Group>

            <SectionTitle>How to describe a problem</SectionTitle>
            <Group>
              <Heading>Helpful information to share</Heading>
              <Bullets
                items={[
                  "What you were doing when the problem happened.",
                  "Any error message you saw on screen.",
                  "Which screen or report you were on.",
                  "Your app version, if you can find it in the About window.",
                  "The date and approximate time of the problem.",
                ]}
              />
              <Heading>What to expect</Heading>
              <Body>
                Once you contact the team, they will reply with guidance or a fix. Please include as much detail as
                possible so you do not have to go back and forth. For urgent issues, WhatsApp is often the fastest way
                to reach us.
              </Body>
            </Group>

            <SectionTitle>About Fig POS</SectionTitle>
            <Group>
              <Heading>Who built Fig POS</Heading>
              <Body>
                {DEVELOPER.studio} and {DEVELOPER.company}. Fig POS is proudly built in {DEVELOPER.country} for mobile
                phone shops that deal in new and used devices, IMEI tracking, credit and analytics.
              </Body>
              <Heading>What Fig POS is for</Heading>
              <Body>
                Fig POS is a complete point of sale built for new and used mobile phone shops. It tracks every phone by
                IMEI, separates new and used stock, supports credit sales and gives you clear reports so you always know
                how your shop is doing.
              </Body>
              <Heading>Updates</Heading>
              <Body>
                Fig POS updates are installed by downloading the latest installer from the releases page.
              </Body>
            </Group>
          </>
        )}
      </main>
    </div>
  );
}
