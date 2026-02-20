import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Check if caller is admin (skip for cron calls with service key)
    const authHeader = req.headers.get("Authorization");
    const isCron = req.headers.get("x-cron-call") === "true";
    
    if (!isCron && authHeader?.startsWith("Bearer ")) {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
      const userClient = createClient(supabaseUrl, anonKey!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
      }
      const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
      }
    }

    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = now.toISOString().split("T")[1].split(".")[0].replace(/:/g, "-");

    // Fetch all data
    const [profiles, userRoles, products, productVariants, orders, orderItems] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("user_roles").select("*"),
      supabase.from("products").select("*"),
      supabase.from("product_variants").select("*"),
      supabase.from("orders").select("*"),
      supabase.from("order_items").select("*"),
    ]);

    const backup = {
      generated_at: now.toISOString(),
      profiles: profiles.data || [],
      user_roles: userRoles.data || [],
      products: products.data || [],
      product_variants: productVariants.data || [],
      orders: orders.data || [],
      order_items: orderItems.data || [],
    };

    const jsonStr = JSON.stringify(backup, null, 2);
    const filePath = `backup-${dateStr}_${timeStr}.json`;

    const { error: uploadError } = await supabase.storage
      .from("backups")
      .upload(filePath, new Blob([jsonStr], { type: "application/json" }), {
        contentType: "application/json",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Record in history
    await supabase.from("backup_history").insert({
      backup_type: "full_backup",
      file_path: filePath,
      created_by: isCron ? "system" : "admin",
      file_size: jsonStr.length,
    });

    // Cleanup: delete backups older than 30 days
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: oldBackups } = await supabase
      .from("backup_history")
      .select("id, file_path")
      .eq("backup_type", "full_backup")
      .lt("created_at", thirtyDaysAgo);

    if (oldBackups && oldBackups.length > 0) {
      const paths = oldBackups.map((b) => b.file_path);
      await supabase.storage.from("backups").remove(paths);
      const ids = oldBackups.map((b) => b.id);
      for (const id of ids) {
        await supabase.from("backup_history").delete().eq("id", id);
      }
    }

    return new Response(
      JSON.stringify({ success: true, file: filePath, size: jsonStr.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
