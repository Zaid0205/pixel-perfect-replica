
-- roles
CREATE TYPE public.app_role AS ENUM ('owner','staff');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_roles_owner_manage" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'owner')) WITH CHECK (public.has_role(auth.uid(),'owner'));
GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

-- new user bootstrap: first user becomes owner, others staff
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_first boolean;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;

  SELECT COUNT(*) = 0 INTO is_first FROM public.user_roles;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN is_first THEN 'owner'::public.app_role ELSE 'staff'::public.app_role end)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- business tables
CREATE TABLE public.distributors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  city text,
  payment_terms_days integer NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.distributors TO authenticated;
GRANT ALL ON public.distributors TO service_role;
ALTER TABLE public.distributors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "distributors_auth_all" ON public.distributors FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sku text UNIQUE,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_auth_all" ON public.products FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id uuid REFERENCES public.distributors(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  order_date date NOT NULL DEFAULT current_date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_auth_all" ON public.orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id uuid REFERENCES public.distributors(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  due_date date NOT NULL DEFAULT current_date,
  paid_date date,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments_auth_all" ON public.payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month date NOT NULL UNIQUE,
  target_amount numeric(12,2) NOT NULL DEFAULT 0,
  predicted_amount numeric(12,2),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.targets TO authenticated;
GRANT ALL ON public.targets TO service_role;
ALTER TABLE public.targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "targets_select" ON public.targets FOR SELECT TO authenticated USING (true);
CREATE POLICY "targets_owner_write" ON public.targets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'owner')) WITH CHECK (public.has_role(auth.uid(),'owner'));

CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_email text,
  action text NOT NULL,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity_select" ON public.activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "activity_insert" ON public.activity_log FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_orders_date ON public.orders(order_date);
CREATE INDEX idx_payments_distributor ON public.payments(distributor_id);
CREATE INDEX idx_activity_created ON public.activity_log(created_at DESC);

-- seed data
INSERT INTO public.distributors (id, name, contact_person, phone, email, city, payment_terms_days) VALUES
 ('11111111-1111-1111-1111-111111111101','Karachi Trade House','Bilal Ahmed','+92 300 1234567','bilal@karachitrade.pk','Karachi',30),
 ('11111111-1111-1111-1111-111111111102','Lahore Supply Co','Ayesha Khan','+92 301 2345678','ayesha@lahoresupply.pk','Lahore',45),
 ('11111111-1111-1111-1111-111111111103','Islamabad Retailers','Usman Tariq','+92 302 3456789','usman@isbretail.pk','Islamabad',15),
 ('11111111-1111-1111-1111-111111111104','Faisalabad Mart','Hina Raza','+92 303 4567890','hina@fsdmart.pk','Faisalabad',30),
 ('11111111-1111-1111-1111-111111111105','Multan Distributors','Zeeshan Ali','+92 304 5678901','zeeshan@multandist.pk','Multan',60);

INSERT INTO public.products (id, name, sku, unit_price) VALUES
 ('22222222-2222-2222-2222-222222222201','Osaka Green Tea 250g','OSK-GT-250',1250.00),
 ('22222222-2222-2222-2222-222222222202','Osaka Soy Sauce 1L','OSK-SS-1L',890.00),
 ('22222222-2222-2222-2222-222222222203','Osaka Rice Noodles 400g','OSK-RN-400',450.00),
 ('22222222-2222-2222-2222-222222222204','Osaka Miso Paste 500g','OSK-MP-500',1600.00),
 ('22222222-2222-2222-2222-222222222205','Osaka Sesame Oil 500ml','OSK-SO-500',2100.00);

INSERT INTO public.orders (distributor_id, product_id, quantity, total_amount, status, order_date)
SELECT d.id, p.id, q.qty, q.qty * p.unit_price, q.st, q.dt
FROM (VALUES
 ('11111111-1111-1111-1111-111111111101','22222222-2222-2222-2222-222222222201',40,'delivered', current_date - 1),
 ('11111111-1111-1111-1111-111111111102','22222222-2222-2222-2222-222222222202',60,'delivered', current_date - 2),
 ('11111111-1111-1111-1111-111111111103','22222222-2222-2222-2222-222222222203',120,'pending', current_date),
 ('11111111-1111-1111-1111-111111111104','22222222-2222-2222-2222-222222222204',25,'delivered', current_date - 4),
 ('11111111-1111-1111-1111-111111111105','22222222-2222-2222-2222-222222222205',30,'delivered', current_date - 6),
 ('11111111-1111-1111-1111-111111111101','22222222-2222-2222-2222-222222222204',45,'delivered', current_date - 9),
 ('11111111-1111-1111-1111-111111111102','22222222-2222-2222-2222-222222222201',80,'delivered', current_date - 12),
 ('11111111-1111-1111-1111-111111111103','22222222-2222-2222-2222-222222222205',20,'cancelled', current_date - 15),
 ('11111111-1111-1111-1111-111111111104','22222222-2222-2222-2222-222222222202',150,'delivered', current_date - 18),
 ('11111111-1111-1111-1111-111111111105','22222222-2222-2222-2222-222222222203',200,'delivered', current_date - 22),
 ('11111111-1111-1111-1111-111111111101','22222222-2222-2222-2222-222222222203',90,'delivered', current_date - 28),
 ('11111111-1111-1111-1111-111111111102','22222222-2222-2222-2222-222222222204',35,'delivered', current_date - 35),
 ('11111111-1111-1111-1111-111111111103','22222222-2222-2222-2222-222222222201',70,'delivered', current_date - 42),
 ('11111111-1111-1111-1111-111111111104','22222222-2222-2222-2222-222222222205',18,'delivered', current_date - 50),
 ('11111111-1111-1111-1111-111111111105','22222222-2222-2222-2222-222222222202',110,'delivered', current_date - 58)
) AS q(did, pid, qty, st, dt)
JOIN public.distributors d ON d.id = q.did::uuid
JOIN public.products p ON p.id = q.pid::uuid;

INSERT INTO public.payments (distributor_id, amount, due_date, paid_date, status) VALUES
 ('11111111-1111-1111-1111-111111111101', 185000.00, current_date + 12, NULL, 'pending'),
 ('11111111-1111-1111-1111-111111111102', 240500.00, current_date + 3, NULL, 'pending'),
 ('11111111-1111-1111-1111-111111111103', 96000.00, current_date - 6, NULL, 'pending'),
 ('11111111-1111-1111-1111-111111111104', 133500.00, current_date + 21, NULL, 'pending'),
 ('11111111-1111-1111-1111-111111111105', 310000.00, current_date - 2, NULL, 'pending'),
 ('11111111-1111-1111-1111-111111111101', 75000.00, current_date - 30, current_date - 29, 'paid'),
 ('11111111-1111-1111-1111-111111111103', 52000.00, current_date - 40, current_date - 41, 'paid');

INSERT INTO public.targets (month, target_amount, predicted_amount) VALUES
 (date_trunc('month', current_date)::date, 1500000.00, 1320000.00),
 (date_trunc('month', current_date - interval '1 month')::date, 1400000.00, 1450000.00);

INSERT INTO public.activity_log (user_email, action, details, created_at) VALUES
 ('system@osaka.pk','Seed data loaded','Demo distributors, products, orders and payments created', now());
