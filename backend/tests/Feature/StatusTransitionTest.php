<?php

namespace Tests\Feature;

use App\Enums\RequestStatus;
use App\Models\RequestStatusHistory;
use App\Models\ServiceRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class StatusTransitionTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();
        $this->owner = User::factory()->create();
        $this->actingAs($this->owner);
    }

    private function makeRequest(RequestStatus $status = RequestStatus::OPEN, int $version = 1): ServiceRequest
    {
        return ServiceRequest::factory()->for($this->owner, 'creator')->status($status, $version)->create();
    }

    public function test_valid_transition_persists_increments_version_and_writes_one_history_row(): void
    {
        $request = $this->makeRequest();

        $this->patchJson("/api/requests/{$request->id}/status", [
            'status' => 'IN_PROGRESS',
            'expected_version' => 1,
            'remark' => 'Technician assigned',
        ])
            ->assertOk()
            ->assertJsonPath('data.status', 'IN_PROGRESS')
            ->assertJsonPath('data.version', 2)
            ->assertJsonPath('data.allowed_next_status', 'RESOLVED');

        $this->assertDatabaseHas('service_requests', ['id' => $request->id, 'status' => 'IN_PROGRESS', 'version' => 2]);
        $this->assertSame(1, RequestStatusHistory::count());
        $this->assertDatabaseHas('request_status_histories', [
            'service_request_id' => $request->id,
            'actor_user_id' => $this->owner->id,
            'from_status' => 'OPEN',
            'to_status' => 'IN_PROGRESS',
            'remark' => 'Technician assigned',
        ]);

        // Second step completes the workflow; history is returned in order.
        $this->patchJson("/api/requests/{$request->id}/status", [
            'status' => 'RESOLVED',
            'expected_version' => 2,
        ])->assertOk()->assertJsonPath('data.version', 3)->assertJsonPath('data.allowed_next_status', null);

        $this->getJson("/api/requests/{$request->id}/history")
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.to_status', 'IN_PROGRESS')
            ->assertJsonPath('data.1.from_status', 'IN_PROGRESS')
            ->assertJsonPath('data.1.to_status', 'RESOLVED');
    }

    /**
     * @return array<string, array{RequestStatus, int, string}>
     */
    public static function invalidTransitions(): array
    {
        return [
            'skip OPEN -> RESOLVED' => [RequestStatus::OPEN, 1, 'RESOLVED'],
            'no-op OPEN -> OPEN' => [RequestStatus::OPEN, 1, 'OPEN'],
            'reverse IN_PROGRESS -> OPEN' => [RequestStatus::IN_PROGRESS, 2, 'OPEN'],
            'no-op IN_PROGRESS -> IN_PROGRESS' => [RequestStatus::IN_PROGRESS, 2, 'IN_PROGRESS'],
            'reverse RESOLVED -> IN_PROGRESS' => [RequestStatus::RESOLVED, 3, 'IN_PROGRESS'],
            'reverse RESOLVED -> OPEN' => [RequestStatus::RESOLVED, 3, 'OPEN'],
            'no-op RESOLVED -> RESOLVED' => [RequestStatus::RESOLVED, 3, 'RESOLVED'],
        ];
    }

    #[DataProvider('invalidTransitions')]
    public function test_invalid_transition_returns_409_and_changes_nothing(RequestStatus $from, int $version, string $target): void
    {
        $request = $this->makeRequest($from, $version);
        $updatedAt = $request->updated_at->toIso8601String();

        $this->patchJson("/api/requests/{$request->id}/status", [
            'status' => $target,
            'expected_version' => $version,
        ])
            ->assertStatus(409)
            ->assertJsonPath('code', 'INVALID_TRANSITION')
            ->assertJsonPath('current_status', $from->value);

        $fresh = $request->fresh();
        $this->assertSame($from, $fresh->status);
        $this->assertSame($version, $fresh->version);
        $this->assertSame($updatedAt, $fresh->updated_at->toIso8601String());
        $this->assertSame(0, RequestStatusHistory::count());
    }

    public function test_stale_expected_version_returns_409_without_overwriting_latest_state(): void
    {
        $request = $this->makeRequest();

        // Client A and B both loaded version 1. A wins.
        $this->patchJson("/api/requests/{$request->id}/status", [
            'status' => 'IN_PROGRESS', 'expected_version' => 1, 'remark' => 'A',
        ])->assertOk();

        // B still holds version 1 and tries a (now otherwise valid) change.
        $this->patchJson("/api/requests/{$request->id}/status", [
            'status' => 'RESOLVED', 'expected_version' => 1, 'remark' => 'B',
        ])
            ->assertStatus(409)
            ->assertJsonPath('code', 'STALE_VERSION')
            ->assertJsonPath('current_version', 2)
            ->assertJsonPath('current.status', 'IN_PROGRESS');

        $this->assertDatabaseHas('service_requests', ['id' => $request->id, 'status' => 'IN_PROGRESS', 'version' => 2]);
        $this->assertSame(1, RequestStatusHistory::count());
        $this->assertDatabaseMissing('request_status_histories', ['remark' => 'B']);
    }

    public function test_future_expected_version_is_also_rejected_as_stale(): void
    {
        $request = $this->makeRequest();

        $this->patchJson("/api/requests/{$request->id}/status", [
            'status' => 'IN_PROGRESS', 'expected_version' => 5,
        ])->assertStatus(409)->assertJsonPath('code', 'STALE_VERSION');

        $this->assertSame(1, $request->fresh()->version);
        $this->assertSame(0, RequestStatusHistory::count());
    }

    public function test_malformed_status_payload_returns_422(): void
    {
        $request = $this->makeRequest();

        $this->patchJson("/api/requests/{$request->id}/status", [
            'status' => 'CLOSED',
            'expected_version' => 'one',
            'remark' => str_repeat('x', 256),
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['status', 'expected_version', 'remark']);

        $this->patchJson("/api/requests/{$request->id}/status", ['status' => 'IN_PROGRESS'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('expected_version');

        $this->assertSame(0, RequestStatusHistory::count());
    }
}
