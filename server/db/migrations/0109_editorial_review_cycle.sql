ALTER TABLE "approval_requests" DROP CONSTRAINT "approval_requests_decision_check";--> statement-breakpoint
ALTER TABLE "approval_requests" ADD COLUMN "editorial_review" jsonb;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD COLUMN "editorial_response" jsonb;--> statement-breakpoint
CREATE UNIQUE INDEX "approval_requests_review_key_unique" ON "approval_requests" USING btree ("project_id",("editorial_review"->>'requestKey')) WHERE "approval_requests"."editorial_review" IS NOT NULL;--> statement-breakpoint
CREATE OR REPLACE FUNCTION protect_author_decision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status <> 'pending' THEN RAISE EXCEPTION 'An author decision is immutable' USING ERRCODE='23514'; END IF;
 IF (to_jsonb(NEW)-ARRAY['status','feedback','decided_at','recorded_by','external_evidence','editorial_response']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','feedback','decided_at','recorded_by','external_evidence','editorial_response']) THEN
   RAISE EXCEPTION 'Approval request identity is immutable' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_decision_check" CHECK (("approval_requests"."status"='pending' AND "approval_requests"."decided_at" IS NULL AND "approval_requests"."recorded_by" IS NULL) OR ("approval_requests"."status" IN ('approved','changes_requested','cancelled') AND "approval_requests"."decided_at" IS NOT NULL AND "approval_requests"."recorded_by" IS NOT NULL AND ("approval_requests"."status"='approved' OR ("approval_requests"."feedback" IS NOT NULL AND length(trim("approval_requests"."feedback"))>0) OR ("approval_requests"."status"='changes_requested' AND (coalesce("approval_requests"."editorial_review"->>'kind'='titles',false) OR "approval_requests"."editorial_response"->'feedbackFile'->>'id' IS NOT NULL)))));
