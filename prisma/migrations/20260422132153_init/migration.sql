-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "firebase_uid" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "profile_photo_url" TEXT,
    "skin_tone" TEXT,
    "body_type" TEXT,
    "style_preferences" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_premium" BOOLEAN NOT NULL DEFAULT false,
    "premium_expires_at" TIMESTAMP(3),
    "fcm_token" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clothes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "fabric_type" TEXT NOT NULL,
    "color_primary" TEXT NOT NULL,
    "color_secondary" TEXT,
    "pattern" TEXT,
    "brand" TEXT,
    "purchase_price" DECIMAL(10,2),
    "purchase_date" TIMESTAMP(3),
    "occasions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "season" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "size" TEXT,
    "care_instructions" TEXT,
    "photo_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "wear_count" INTEGER NOT NULL DEFAULT 0,
    "wash_count" INTEGER NOT NULL DEFAULT 0,
    "last_worn_at" TIMESTAMP(3),
    "last_washed_at" TIMESTAMP(3),
    "quality_score" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clothes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outfit_suggestions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "occasion" TEXT NOT NULL,
    "clothes_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "style_score" DECIMAL(5,2) NOT NULL,
    "color_harmony_score" DECIMAL(5,2) NOT NULL,
    "ai_explanation" TEXT NOT NULL,
    "weather_data" JSONB,
    "date_suggested" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_worn" BOOLEAN NOT NULL DEFAULT false,
    "worn_at" TIMESTAMP(3),
    "is_saved" BOOLEAN NOT NULL DEFAULT false,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outfit_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_history" (
    "id" UUID NOT NULL,
    "cloth_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "quality_score" DECIMAL(5,2) NOT NULL,
    "wear_count_at_record" INTEGER NOT NULL,
    "wash_count_at_record" INTEGER NOT NULL,
    "notes" TEXT,
    "recorded_at" TIMESTAMP(3) NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quality_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "occasions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "occasion_type" TEXT NOT NULL,
    "outfit_suggestion_id" UUID,
    "outfit_date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "occasions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "data" JSONB,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wash_records" (
    "id" UUID NOT NULL,
    "cloth_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "wash_type" TEXT NOT NULL,
    "wash_date" TIMESTAMP(3) NOT NULL,
    "water_temperature" TEXT,
    "notes" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wash_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_outfits" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "clothes_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "occasion_tag" TEXT,
    "style_score" DECIMAL(5,2),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_outfits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wedding_plans" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "event_name" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "functions" JSONB NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wedding_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "morning_outfit_time" TEXT NOT NULL DEFAULT '07:00',
    "laundry_reminder" BOOLEAN NOT NULL DEFAULT true,
    "quality_alerts" BOOLEAN NOT NULL DEFAULT true,
    "weekly_report" BOOLEAN NOT NULL DEFAULT true,
    "language" TEXT NOT NULL DEFAULT 'en',
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_firebase_uid_key" ON "users"("firebase_uid");

-- CreateIndex
CREATE INDEX "users_firebase_uid_idx" ON "users"("firebase_uid");

-- CreateIndex
CREATE INDEX "users_phone_idx" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_is_deleted_idx" ON "users"("is_deleted");

-- CreateIndex
CREATE INDEX "clothes_user_id_idx" ON "clothes"("user_id");

-- CreateIndex
CREATE INDEX "clothes_category_idx" ON "clothes"("category");

-- CreateIndex
CREATE INDEX "clothes_fabric_type_idx" ON "clothes"("fabric_type");

-- CreateIndex
CREATE INDEX "clothes_is_deleted_idx" ON "clothes"("is_deleted");

-- CreateIndex
CREATE INDEX "outfit_suggestions_user_id_date_suggested_idx" ON "outfit_suggestions"("user_id", "date_suggested");

-- CreateIndex
CREATE INDEX "outfit_suggestions_is_deleted_idx" ON "outfit_suggestions"("is_deleted");

-- CreateIndex
CREATE INDEX "quality_history_cloth_id_user_id_idx" ON "quality_history"("cloth_id", "user_id");

-- CreateIndex
CREATE INDEX "quality_history_is_deleted_idx" ON "quality_history"("is_deleted");

-- CreateIndex
CREATE INDEX "occasions_user_id_idx" ON "occasions"("user_id");

-- CreateIndex
CREATE INDEX "occasions_outfit_suggestion_id_idx" ON "occasions"("outfit_suggestion_id");

-- CreateIndex
CREATE INDEX "occasions_is_deleted_idx" ON "occasions"("is_deleted");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "notifications_is_deleted_idx" ON "notifications"("is_deleted");

-- CreateIndex
CREATE INDEX "wash_records_cloth_id_user_id_idx" ON "wash_records"("cloth_id", "user_id");

-- CreateIndex
CREATE INDEX "wash_records_is_deleted_idx" ON "wash_records"("is_deleted");

-- CreateIndex
CREATE INDEX "saved_outfits_user_id_idx" ON "saved_outfits"("user_id");

-- CreateIndex
CREATE INDEX "saved_outfits_is_deleted_idx" ON "saved_outfits"("is_deleted");

-- CreateIndex
CREATE INDEX "wedding_plans_user_id_idx" ON "wedding_plans"("user_id");

-- CreateIndex
CREATE INDEX "wedding_plans_is_deleted_idx" ON "wedding_plans"("is_deleted");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_user_id_key" ON "user_preferences"("user_id");

-- CreateIndex
CREATE INDEX "user_preferences_is_deleted_idx" ON "user_preferences"("is_deleted");

-- AddForeignKey
ALTER TABLE "clothes" ADD CONSTRAINT "clothes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outfit_suggestions" ADD CONSTRAINT "outfit_suggestions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_history" ADD CONSTRAINT "quality_history_cloth_id_fkey" FOREIGN KEY ("cloth_id") REFERENCES "clothes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_history" ADD CONSTRAINT "quality_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occasions" ADD CONSTRAINT "occasions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occasions" ADD CONSTRAINT "occasions_outfit_suggestion_id_fkey" FOREIGN KEY ("outfit_suggestion_id") REFERENCES "outfit_suggestions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wash_records" ADD CONSTRAINT "wash_records_cloth_id_fkey" FOREIGN KEY ("cloth_id") REFERENCES "clothes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wash_records" ADD CONSTRAINT "wash_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_outfits" ADD CONSTRAINT "saved_outfits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wedding_plans" ADD CONSTRAINT "wedding_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
