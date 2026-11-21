<?php

namespace Tests\Feature;

use App\Enums\RequestStatus;
use App\Models\RequestStatusHistory;
use App\Models\ServiceRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ServiceRequestAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_cannot_read_or_change_another_users_request_or_history(): void
    {
        $owner = User::factory()->create();
        $intruder = User::factory()->create();
        $request = ServiceRequest::factory()->for($owner, 'creator')->create();
        RequestStatusHistory::create([
            'service_request_id' => $request->id,
            'actor_user_id' => $owner->id,
            'from_status' => RequestStatus::OPEN,
            'to_status' => RequestStatus::IN_PROGRESS,
        ]);
        $request->forceFill(['status' => RequestStatus::IN_PROGRESS, 'version' => 2])->save();

        $this->actingAs($intruder);

        // Non-owned records are reported as 404 (same as unknown ids).
        $this->getJson("/api/requests/{$request->id}")
            ->assertNotFound()
            ->assertJsonPath('code', 'NOT_FOUND');
        $this->getJson("/api/requests/{$request->id}/history")->assertNotFound();
        $this->patchJson("/api/requests/{$request->id}/status", [
            'status' => 'RESOLVED',
            'expected_version' => 2,
        ])->assertNotFound();

        $this->getJson('/api/requests')
            ->assertOk()
            ->assertJsonCount(0, 'data');

        // Nothing changed.
        $this->assertDatabaseHas('service_requests', ['id' => $request->id, 'status' => 'IN_PROGRESS', 'version' => 2]);
        $this->assertSame(1, RequestStatusHistory::count());
    }

    public function test_unknown_request_returns_404(): void
    {
        $this->actingAs(User::factory()->create());

        $this->getJson('/api/requests/999')->assertNotFound()->assertJsonPath('code', 'NOT_FOUND');
    }

    public function test_list_returns_only_own_requests_newest_first(): void
    {
        $me = User::factory()->create();
        $other = User::factory()->create();

        $old = ServiceRequest::factory()->for($me, 'creator')->create(['created_at' => now()->subDay()]);
        $new = ServiceRequest::factory()->for($me, 'creator')->create(['created_at' => now()]);
        ServiceRequest::factory()->for($other, 'creator')->count(3)->create();

        $this->actingAs($me)
            ->getJson('/api/requests')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $new->id)
            ->assertJsonPath('data.1.id', $old->id)
            ->assertJsonPath('meta.total', 2);
    }

    public function test_list_supports_search_combined_filters_and_pagination_limits(): void
    {
        $me = User::factory()->create();
        $match = ServiceRequest::factory()->for($me, 'creator')->create([
            'title' => 'Printer not working', 'priority' => 'HIGH', 'status' => 'OPEN',
        ]);
        ServiceRequest::factory()->for($me, 'creator')->create([
            'title' => 'Printer toner low', 'priority' => 'LOW', 'status' => 'OPEN',
        ]);
        ServiceRequest::factory()->for($me, 'creator')->create([
            'title' => 'Printer paper jam', 'priority' => 'HIGH', 'status' => 'IN_PROGRESS', 'version' => 2,
        ]);
        ServiceRequest::factory()->for($me, 'creator')->create([
            'title' => 'VPN issue', 'priority' => 'HIGH', 'status' => 'OPEN',
        ]);

        $this->actingAs($me);

        $this->getJson('/api/requests?search=printer&status=OPEN&priority=HIGH')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $match->id);

        // "%" is matched literally, not as a wildcard.
        $this->getJson('/api/requests?search=%25')->assertOk()->assertJsonCount(0, 'data');

        $this->getJson('/api/requests')->assertJsonPath('meta.per_page', 10);
        $this->getJson('/api/requests?per_page=2')->assertJsonCount(2, 'data')->assertJsonPath('meta.last_page', 2);
        $this->getJson('/api/requests?per_page=26')->assertStatus(422)->assertJsonValidationErrors('per_page');
        $this->getJson('/api/requests?status=DONE')->assertStatus(422)->assertJsonValidationErrors('status');
    }
}
