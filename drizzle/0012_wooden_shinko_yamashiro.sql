CREATE INDEX "categories_userId_idx" ON "categories" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "categories_isDefault_idx" ON "categories" USING btree ("isDefault");--> statement-breakpoint
CREATE INDEX "events_userId_idx" ON "events" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "events_month_idx" ON "events" USING btree ("month");--> statement-breakpoint
CREATE INDEX "events_userId_month_idx" ON "events" USING btree ("userId","month");--> statement-breakpoint
CREATE INDEX "goals_userId_idx" ON "goals" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "goals_status_idx" ON "goals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "goals_userId_status_idx" ON "goals" USING btree ("userId","status");--> statement-breakpoint
CREATE INDEX "projects_userId_idx" ON "projects" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "projects_month_year_idx" ON "projects" USING btree ("month","year");--> statement-breakpoint
CREATE INDEX "projects_userId_month_year_idx" ON "projects" USING btree ("userId","month","year");--> statement-breakpoint
CREATE INDEX "transactions_userId_idx" ON "transactions" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "transactions_goalId_idx" ON "transactions" USING btree ("goalId");--> statement-breakpoint
CREATE INDEX "transactions_categoryId_idx" ON "transactions" USING btree ("categoryId");--> statement-breakpoint
CREATE INDEX "transactions_userId_goalId_idx" ON "transactions" USING btree ("userId","goalId");--> statement-breakpoint
CREATE INDEX "transactions_createdDate_idx" ON "transactions" USING btree ("createdDate");