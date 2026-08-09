alter table public.restaurant_settings
  add column if not exists receipt_printer_enabled boolean not null default false,
  add column if not exists receipt_paper_width smallint not null default 80,
  add column if not exists receipt_print_copies smallint not null default 1,
  add column if not exists auto_print_orders boolean not null default false;

alter table public.restaurant_settings
  drop constraint if exists restaurant_settings_receipt_paper_width_valid,
  drop constraint if exists restaurant_settings_receipt_print_copies_valid;

alter table public.restaurant_settings
  add constraint restaurant_settings_receipt_paper_width_valid
    check (receipt_paper_width in (58, 80)),
  add constraint restaurant_settings_receipt_print_copies_valid
    check (receipt_print_copies between 1 and 3);

comment on column public.restaurant_settings.receipt_printer_enabled is
  'Ativa o fluxo de impressão de comandas térmicas no painel do restaurante.';

comment on column public.restaurant_settings.receipt_paper_width is
  'Largura do rolo térmico em milímetros: 58 ou 80.';

comment on column public.restaurant_settings.receipt_print_copies is
  'Número de vias geradas em cada impressão, entre 1 e 3.';

comment on column public.restaurant_settings.auto_print_orders is
  'Abre automaticamente a impressão quando um novo pedido chega neste painel.';
