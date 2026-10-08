export type PrintLayout = "thermal-58" | "thermal-80" | "a4";

export function printCurrentView(layout: PrintLayout = "a4") {
  const previousLayout = document.documentElement.dataset.printLayout;
  document.documentElement.dataset.printLayout = layout;
  window.print();

  if (previousLayout) document.documentElement.dataset.printLayout = previousLayout;
  else delete document.documentElement.dataset.printLayout;
}
