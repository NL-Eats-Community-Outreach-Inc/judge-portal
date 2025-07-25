import { createClient } from '@supabase/supabase-js'

// Use environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function createActiveEvent() {
  try {
    console.log('Creating active event with sample data...')
    
    // Create or update an event to active status
    const { data: event, error: eventError } = await supabase
      .from('events')
      .upsert({
        name: 'Demo Hackathon 2025',
        description: 'A demo hackathon for testing the judging system',
        status: 'active'
      })
      .select()
      .single()

    if (eventError) {
      console.error('Error creating event:', eventError)
      return
    }

    console.log('Event created:', event)

    // Create sample teams
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .upsert([
        {
          event_id: event.id,
          name: 'Team Alpha',
          description: 'Building the next generation AI assistant',
          demo_url: 'https://demo.alpha.com',
          repo_url: 'https://github.com/team-alpha/project',
          presentation_order: 1
        },
        {
          event_id: event.id,
          name: 'Team Beta', 
          description: 'Revolutionary blockchain solution for sustainability',
          demo_url: 'https://demo.beta.com',
          repo_url: 'https://github.com/team-beta/project',
          presentation_order: 2
        },
        {
          event_id: event.id,
          name: 'Team Gamma',
          description: 'Mobile app for enhancing community connections', 
          demo_url: 'https://demo.gamma.com',
          repo_url: 'https://github.com/team-gamma/project',
          presentation_order: 3
        }
      ])
      .select()

    if (teamsError) {
      console.error('Error creating teams:', teamsError)
      return
    }

    console.log('Teams created:', teams)

    // Create sample criteria
    const { data: criteria, error: criteriaError } = await supabase
      .from('criteria')
      .upsert([
        {
          event_id: event.id,
          name: 'Innovation',
          description: 'How innovative and creative is the solution?',
          min_score: 1,
          max_score: 10,
          display_order: 1
        },
        {
          event_id: event.id,
          name: 'Technical Implementation',
          description: 'Quality of the technical execution and code',
          min_score: 1,
          max_score: 10,
          display_order: 2
        },
        {
          event_id: event.id,
          name: 'User Experience',
          description: 'How intuitive and user-friendly is the solution?',
          min_score: 1,
          max_score: 10,
          display_order: 3
        },
        {
          event_id: event.id,
          name: 'Business Viability',
          description: 'Potential for real-world application and scalability',
          min_score: 1,
          max_score: 10,
          display_order: 4
        }
      ])
      .select()

    if (criteriaError) {
      console.error('Error creating criteria:', criteriaError)
      return
    }

    console.log('Criteria created:', criteria)
    console.log('Active event setup complete!')

  } catch (error) {
    console.error('Error setting up active event:', error)
  }
}

createActiveEvent()