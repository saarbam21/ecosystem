// Central place for site-wide details. Edit here to update everywhere.
export const site = {
  name: "Ecosystem",
  tagline: "תכנון פיננסי ליחידים ומשפחות",
  url: "https://ecosystemplan.com",
  owner: "סער באם",
  phone: "050-6676409",
  phoneIntl: "972506676409",
  email: "saarbam21@gmail.com",
  whatsapp: "https://wa.me/972506676409",
  facebook: "https://www.facebook.com/profile.php?id=100076402028462",
  // Get a free access key at https://web3forms.com (no account needed) and paste it here.
  web3formsKey: "231ce47d-7ca2-4688-9917-889b19a02e5a",
};

export const nav = [
  { href: "/", label: "בית" },
  { href: "/services/", label: "השירותים שלי" },
  { href: "/blog/", label: "בלוג" },
  {
    href: "/calculators/",
    label: "מחשבונים",
    children: [
      { href: "/calculators/", label: "מחשבון קצבה" },
      { href: "/calculators/net/", label: "מחשבון קצבה נטו" },
      { href: "/calculators/income-tax/", label: "מחשבון מס הכנסה" },
      { href: "/calculators/miluim/", label: "מחשבון מילואים" },
    ],
  },
  { href: "/faq/", label: "שאלות נפוצות" },
  { href: "/about/", label: "אודות" },
  { href: "/contact/", label: "צור קשר" },
];
