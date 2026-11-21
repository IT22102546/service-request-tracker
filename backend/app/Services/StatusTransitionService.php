<?php

namespace App\Services;

use App\Enums\RequestStatus;
use App\Exceptions\WorkflowConflictException;
use App\Http\Resources\ServiceRequestResource;
use App\Models\RequestStatusHistory;
use App\Models\ServiceRequest;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class StatusTransitionService
{
    /**
     * Move a request to $target using optimistic locking.
     *
     * The version check and the update are one atomic statement:
     *   UPDATE service_requests SET status = ?, version = version + 1
     *   WHERE id = ? AND version = ? AND status = ?
     * If another change landed first, 0 rows match and nothing is written.
     * The history row is inserted in the same transaction, so a status
     * change and its audit record are always committed (or rolled back) together.
     *
     * @throws WorkflowConflictException 409 for stale version / invalid transition
     */
    public function transition(
        ServiceRequest $serviceRequest,
        User $actor,
        RequestStatus $target,
        int $expectedVersion,
        ?string $remark,
    ): ServiceRequest {
        return DB::transaction(function () use ($serviceRequest, $actor, $target, $expectedVersion, $remark) {
            // Re-read inside the transaction so decisions use the latest committed row.
            $current = ServiceRequest::query()->lockForUpdate()->findOrFail($serviceRequest->id);

            $this->assertVersion($current, $expectedVersion);
            $this->assertTransition($current, $target);

            $from = $current->status;

            $affected = ServiceRequest::query()
                ->whereKey($current->id)
                ->where('version', $expectedVersion)
                ->where('status', $from->value)
                ->update([
                    'status' => $target->value,
                    'version' => DB::raw('version + 1'),
                    'updated_at' => now(),
                ]);

            if ($affected !== 1) {
                // Lost a race between the read and the write.
                $this->throwStale($current->fresh());
            }

            RequestStatusHistory::create([
                'service_request_id' => $current->id,
                'actor_user_id' => $actor->id,
                'from_status' => $from,
                'to_status' => $target,
                'remark' => $remark !== null && trim($remark) !== '' ? trim($remark) : null,
            ]);

            return $current->fresh();
        });
    }

    private function assertVersion(ServiceRequest $current, int $expectedVersion): void
    {
        if ($current->version !== $expectedVersion) {
            $this->throwStale($current);
        }
    }

    private function assertTransition(ServiceRequest $current, RequestStatus $target): void
    {
        if ($current->status === $target) {
            throw new WorkflowConflictException(
                WorkflowConflictException::INVALID_TRANSITION,
                "Request is already {$target->value}.",
                ['current_status' => $current->status->value, 'allowed_next_status' => $current->status->next()?->value],
            );
        }

        if (! $current->status->canTransitionTo($target)) {
            $allowed = $current->status->next();

            throw new WorkflowConflictException(
                WorkflowConflictException::INVALID_TRANSITION,
                $allowed === null
                    ? "Request is {$current->status->value}; no further status changes are allowed."
                    : "Cannot change status from {$current->status->value} to {$target->value}. Allowed next status: {$allowed->value}.",
                ['current_status' => $current->status->value, 'allowed_next_status' => $allowed?->value],
            );
        }
    }

    private function throwStale(ServiceRequest $latest): never
    {
        throw new WorkflowConflictException(
            WorkflowConflictException::STALE_VERSION,
            'This request was changed by someone else. Reload the latest version and try again.',
            [
                'current_version' => $latest->version,
                'current' => (new ServiceRequestResource($latest))->resolve(),
            ],
        );
    }
}
