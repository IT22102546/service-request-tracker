<?php

namespace Database\Seeders;

use App\Enums\RequestPriority;
use App\Enums\RequestStatus;
use App\Models\ServiceRequest;
use App\Models\User;
use App\Services\StatusTransitionService;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Two local demo accounts (password: "password") with requests in every
     * status, so cross-user isolation and the full workflow can be checked by hand.
     */
    public function run(StatusTransitionService $workflow): void
    {
        $alice = User::updateOrCreate(
            ['email' => 'alice@example.com'],
            ['name' => 'Alice Perera', 'password' => 'password'],
        );

        $bob = User::updateOrCreate(
            ['email' => 'bob@example.com'],
            ['name' => 'Bob Fernando', 'password' => 'password'],
        );

        $this->seedRequests($workflow, $alice, [
            ['Printer not working', 'Office printer on floor 2 stopped responding.', RequestPriority::HIGH, []],
            ['Request new monitor', 'Second monitor needed for the finance workstation.', RequestPriority::LOW, []],
            ['VPN keeps disconnecting', 'VPN drops every 10 minutes when working remotely.', RequestPriority::MEDIUM, [
                [RequestStatus::IN_PROGRESS, 'Network team is checking the VPN gateway logs.'],
            ]],
            ['Email signature update', 'Please update my email signature with the new job title.', RequestPriority::LOW, [
                [RequestStatus::IN_PROGRESS, 'Picked up by IT support.'],
                [RequestStatus::RESOLVED, 'Signature updated and confirmed by the user.'],
            ]],
            ['Projector flickering in boardroom', 'The boardroom projector flickers every few seconds during meetings.', RequestPriority::MEDIUM, [
                [RequestStatus::IN_PROGRESS, 'Technician assigned.'],
                [RequestStatus::RESOLVED, 'Replaced the HDMI cable.'],
            ]],
        ]);

        $this->seedRequests($workflow, $bob, [
            ['Laptop battery swelling', 'Laptop battery is swollen and the case is lifting.', RequestPriority::HIGH, [
                [RequestStatus::IN_PROGRESS, 'Replacement battery ordered.'],
            ]],
            ['Access to shared drive', 'Need read access to the procurement shared drive.', RequestPriority::MEDIUM, []],
            ['Keyboard keys sticking', 'Several keys on my keyboard stick after the coffee spill.', RequestPriority::LOW, [
                [RequestStatus::IN_PROGRESS, null],
                [RequestStatus::RESOLVED, 'Keyboard replaced.'],
            ]],
        ]);
    }

    /**
     * Creates each request as OPEN, then moves it through the given steps using
     * the same service as the API, so version numbers and history rows are real.
     *
     * @param  list<array{0:string,1:string,2:RequestPriority,3:list<array{0:RequestStatus,1:?string}>}>  $rows
     */
    private function seedRequests(StatusTransitionService $workflow, User $owner, array $rows): void
    {
        if ($owner->serviceRequests()->exists()) {
            return;
        }

        foreach ($rows as [$title, $description, $priority, $steps]) {
            $request = new ServiceRequest([
                'title' => $title,
                'description' => $description,
                'priority' => $priority,
            ]);
            $request->created_by = $owner->id;
            $request->status = RequestStatus::OPEN;
            $request->save();

            foreach ($steps as [$target, $remark]) {
                $request = $workflow->transition($request, $owner, $target, $request->version, $remark);
            }
        }
    }
}
